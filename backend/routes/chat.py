# backend/routes/chat.py

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import uuid

from orchestrator.router import smart_route
from security import require_user
from utils.supabase_client import supabase

router = APIRouter()


# ✅ REQUEST MODEL
class ChatRequest(BaseModel):
    chat_id: str
    message: str


# ✅ EXTRACT USER ID SAFELY
def _uid(user: dict) -> str:
    if not user or "id" not in user:
        raise HTTPException(status_code=401, detail="Invalid user")
    return user["id"]


# ✅ VERIFY OR CREATE CHAT (🔥 FIXED)
def verify_or_create_chat(user_id, chat_id):
    try:
        # Check if chat exists
        res = supabase.table("chats") \
            .select("id, user_id") \
            .eq("id", chat_id) \
            .execute()

        if res.data:
            # Chat exists → verify ownership
            if res.data[0]["user_id"] != user_id:
                return False
            return True

        # 🚀 Chat does NOT exist → create it
        supabase.table("chats").insert({
            "id": chat_id,
            "user_id": user_id
        }).execute()

        print("✅ New chat created:", chat_id)
        return True

    except Exception as e:
        print("❌ Chat verify/create error:", e)
        return False


# ✅ SAVE MESSAGE
def save_message(user_id, chat_id, role, content):
    try:
        supabase.table("messages").insert({
            "user_id": user_id,
            "chat_id": chat_id,
            "role": role,
            "content": content
        }).execute()
    except Exception as e:
        print("❌ Supabase insert error:", e)


# ✅ GET CHAT HISTORY
def get_chat_history(user_id, chat_id):
    try:
        res = supabase.table("messages") \
            .select("role, content, created_at") \
            .eq("user_id", user_id) \
            .eq("chat_id", chat_id) \
            .order("created_at") \
            .execute()

        return res.data or []

    except Exception as e:
        print("❌ Fetch error:", e)
        return []


# 🚀 MAIN API
@router.post("/ask")
def ask(req: ChatRequest, current_user=Depends(require_user)):

    # ✅ GET USER ID
    user_id = _uid(current_user)

    # ✅ VALIDATIONS
    if not req.chat_id:
        raise HTTPException(status_code=400, detail="chat_id is required")

    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    print("👤 USER:", user_id)
    print("💬 CHAT:", req.chat_id)

    # 🔥 VERIFY OR CREATE CHAT (FIXED)
    if not verify_or_create_chat(user_id, req.chat_id):
        raise HTTPException(status_code=403, detail="Unauthorized chat access")

    # ✅ SAVE USER MESSAGE
    save_message(user_id, req.chat_id, "user", req.message)

    # ✅ FETCH HISTORY
    history = get_chat_history(user_id, req.chat_id)

    # ✅ BUILD CONTEXT
    context = "\n".join([f"{m['role']}: {m['content']}" for m in history])

    # ✅ AI RESPONSE
    try:
        reply = smart_route(context, "")
    except Exception as e:
        reply = f"⚠️ AI error: {e}"

    # ✅ SAVE AI RESPONSE
    save_message(user_id, req.chat_id, "assistant", reply)

    return {
        "chat_id": req.chat_id,
        "reply": reply,
    }

@router.get("/history")
def get_history(current_user=Depends(require_user)):
    user_id = _uid(current_user)

    try:
        chats = supabase.table("chats") \
            .select("*") \
            .eq("user_id", user_id) \
            .execute()

        return {
            "chats": chats.data or []
        }

    except Exception as e:
        print("❌ History error:", e)
        raise HTTPException(status_code=500, detail="Failed to fetch history")
