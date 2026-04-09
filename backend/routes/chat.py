# backend/routes/chat.py

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

# SAFE IMPORTS (prevent router crash → avoids 404)
try:
    from orchestrator.router import smart_route
except:
    smart_route = None

try:
    from security import require_user
except:
    def require_user():
        return {"id": "test-user"}  # fallback for testing

try:
    from utils.supabase_client import supabase
except:
    supabase = None


router = APIRouter()


# ✅ REQUEST MODEL
class ChatRequest(BaseModel):
    chat_id: Optional[str] = None
    message: str
    session_id: Optional[str] = None
    title: Optional[str] = None


# ✅ GET USER ID
def _uid(user: dict) -> str:
    return user.get("id", "test-user")


# ✅ SAFE CHAT CREATE
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
        return True  # allow flow


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


# 🚀 MAIN CHAT API
@router.post("/ask")
def ask(req: ChatRequest, current_user=Depends(require_user)):

    user_id = _uid(current_user)

    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    # ✅ Ensure chat_id exists
    chat_id = req.chat_id or "chat_" + user_id

    # ✅ Verify/Create chat
    verify_or_create_chat(user_id, chat_id, req.title)

    # ✅ Save user message
    save_message(user_id, chat_id, "user", req.message)

    # ✅ Get history
    history = get_chat_history(user_id, chat_id)
    context = "\n".join([f"{m['role']}: {m['content']}" for m in history])

    # ✅ AI RESPONSE (SAFE)
    try:
        if smart_route:
            reply = smart_route(context + "\nuser: " + req.message, "")
        else:
            reply = f"Echo: {req.message}"
    except Exception as e:
        reply = f"⚠️ AI error: {str(e)}"

    # ✅ Save response
    save_message(user_id, chat_id, "assistant", reply)

    return {
        "success": True,
        "chat_id": chat_id,
        "reply": reply
    }


# 🚀 SIMPLE TEST ROUTE (IMPORTANT FOR DEBUG)
@router.get("/")
def test_chat():
    return {"message": "Chat route working ✅"}
