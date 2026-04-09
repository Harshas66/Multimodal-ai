# backend/routes/chat.py

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from utils.image_analyzer import analyze_image

# SAFE IMPORTS (prevent crash → avoids 404)
try:
    from orchestrator.router import smart_route
except:
    smart_route = None

try:
    from security import require_user
except:
    def require_user():
        return {"id": "test-user"}  # fallback

try:
    from utils.supabase_client import supabase
except:
    supabase = None


router = APIRouter()


# ✅ REQUEST MODEL (UPDATED FOR IMAGE SUPPORT)
class ChatRequest(BaseModel):
    chat_id: Optional[str] = None
    message: Optional[str] = ""
    image_url: Optional[str] = None   # 🔥 IMAGE SUPPORT
    session_id: Optional[str] = None
    title: Optional[str] = None


# ✅ GET USER ID
def _uid(user: dict) -> str:
    return user.get("id", "test-user")


# ✅ VERIFY / CREATE CHAT
def verify_or_create_chat(user_id, chat_id, title=None):
    if not supabase:
        return True

    try:
        res = supabase.table("chats") \
            .select("id, user_id") \
            .eq("id", chat_id) \
            .execute()

        if res.data:
            return res.data[0]["user_id"] == user_id

        supabase.table("chats").insert({
            "id": chat_id,
            "user_id": user_id,
            "title": title or "New Chat"
        }).execute()

        return True

    except Exception as e:
        print("❌ Chat error:", e)
        return True


# ✅ SAVE MESSAGE
def save_message(user_id, chat_id, role, content):
    if not supabase:
        return

    try:
        supabase.table("messages").insert({
            "user_id": user_id,
            "chat_id": chat_id,
            "role": role,
            "content": content
        }).execute()
    except Exception as e:
        print("❌ Save error:", e)


# ✅ FETCH HISTORY
def get_chat_history(user_id, chat_id):
    if not supabase:
        return []

    try:
        res = supabase.table("messages") \
            .select("*") \
            .eq("user_id", user_id) \
            .eq("chat_id", chat_id) \
            .order("created_at") \
            .execute()

        return res.data or []

    except Exception as e:
        print("❌ History error:", e)
        return []


# 🚀 MAIN CHAT API (MULTIMODAL)
@router.post("/ask")
def ask(req: ChatRequest, current_user=Depends(require_user)):

    user_id = _uid(current_user)

    # ✅ Validate input
    if not req.message and not req.image_url:
        raise HTTPException(status_code=400, detail="Message or image required")

    chat_id = req.chat_id or f"chat_{user_id}"

    # ✅ Verify/Create chat
    verify_or_create_chat(user_id, chat_id, req.title)

    # ✅ Save user input
    user_content = req.message if req.message else "[Image]"
    if req.image_url:
        user_content += f" (Image: {req.image_url})"

    save_message(user_id, chat_id, "user", user_content)

    # ✅ Get history
    history = get_chat_history(user_id, chat_id)
    context = "\n".join([f"{m['role']}: {m['content']}" for m in history])

    # ✅ AI RESPONSE
    try:
        # 🔥 CASE 1: IMAGE PRESENT
        if req.image_url:
            caption = analyze_image(req.image_url)

            # 🔥 IMAGE + TEXT (BEST CASE)
            if req.message:
                combined_input = f"""
                Image description: {caption}
                User question: {req.message}
                """

                if smart_route:
                    reply = smart_route(combined_input, "")
                else:
                    reply = f"🖼️ {caption}\n\n💬 {req.message}"

            # 🔥 IMAGE ONLY
            else:
                reply = f"🖼️ Image Analysis:\n{caption}"

        # 🔥 CASE 2: TEXT ONLY
        elif smart_route:
            reply = smart_route(context + "\nuser: " + req.message, "")
        else:
            reply = f"Echo: {req.message}"

    except Exception as e:
        reply = f"⚠️ AI error: {str(e)}"

    # ✅ Save assistant response
    save_message(user_id, chat_id, "assistant", reply)

    return {
        "success": True,
        "chat_id": chat_id,
        "reply": reply
    }


# 🚀 TEST ROUTE
@router.get("/")
def test_chat():
    return {"message": "Chat route working ✅"}
