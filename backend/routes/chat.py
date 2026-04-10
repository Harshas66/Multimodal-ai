# backend/routes/chat.py

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from utils.image_analyzer import analyze_image
from utils.supabase_client import supabase
from security import require_user

try:
    from orchestrator.router import smart_route
except:
    smart_route = None


router = APIRouter()


# ✅ REQUEST MODEL
class ChatRequest(BaseModel):
    chat_id: Optional[str] = None
    message: Optional[str] = ""
    image_url: Optional[str] = None
    session_id: Optional[str] = None
    title: Optional[str] = None


# ✅ USER ID
def _uid(user: dict) -> str:
    return user.get("id", "test-user")


# ✅ GET CHAT HISTORY
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
    except:
        return []


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
    except:
        pass


# 🚀 MAIN API
@router.post("/ask")
def ask(req: ChatRequest, current_user=Depends(require_user)):

    user_id = _uid(current_user)

    if not req.message and not req.image_url:
        raise HTTPException(status_code=400, detail="Message or image required")

    chat_id = req.chat_id or f"chat_{user_id}"

    # ✅ SAVE USER INPUT
    user_content = req.message if req.message else "[Image]"
    if req.image_url:
        user_content += f" (Image: {req.image_url})"

    save_message(user_id, chat_id, "user", user_content)

    # 🔥 MEMORY LOGIC (INSIDE FUNCTION ONLY)
    memory_enabled = current_user.get("memory_enabled", True)

    if memory_enabled:
        try:
            res = supabase.table("messages") \
                .select("*") \
                .eq("user_id", user_id) \
                .order("created_at") \
                .execute()

            history = res.data or []
        except:
            history = []
    else:
        history = get_chat_history(user_id, chat_id)

    # limit memory
    history = history[-20:]

    context = "\n".join([f"{m['role']}: {m['content']}" for m in history])

    # ✅ AI RESPONSE
    try:
        if req.image_url:
            caption = analyze_image(req.image_url)

            if req.message:
                combined_input = f"""
                Image description: {caption}
                User question: {req.message}
                """

                if smart_route:
                    reply = smart_route(combined_input, "")
                else:
                    reply = f"🖼️ {caption}\n\n💬 {req.message}"
            else:
                reply = f"🖼️ Image Analysis:\n{caption}"

        elif smart_route:
            reply = smart_route(context + "\nuser: " + req.message, "")
        else:
            reply = f"Echo: {req.message}"

    except Exception as e:
        reply = f"⚠️ AI error: {str(e)}"

    save_message(user_id, chat_id, "assistant", reply)

    return {
        "success": True,
        "chat_id": chat_id,
        "reply": reply
    }


# ✅ TEST ROUTE
@router.get("/")
def test_chat():
    return {"message": "Chat route working ✅"}
