# backend/routes/chat.py

import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from orchestrator.router import smart_route
from security import require_user
from utils.supabase_client import supabase

router = APIRouter()


def save_message(user_id, chat_id, role, content):
    try:
        if not supabase:
            return

        supabase.table("messages").insert({
            "user_id": user_id,
            "chat_id": chat_id,
            "role": role,
            "content": content
        }).execute()

    except Exception as e:
        print("Supabase error:", e)


class ChatRequest(BaseModel):
    chat_id: str
    message: str


def _uid(decoded: dict) -> str:
    return decoded.get("uid", "demo_user")


@router.post("/ask")
def ask(req: ChatRequest, current_user=Depends(require_user)):

    user_id = _uid(current_user)

    if not req.chat_id:
        raise HTTPException(status_code=400, detail="chat_id is required")

    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    print("USER:", user_id, "CHAT:", req.chat_id)

    save_message(user_id, req.chat_id, "user", req.message)

    history = get_chat_history(user_id, req.chat_id)

    context = "\n".join([f"{m['role']}: {m['content']}" for m in history])

    try:
        reply = smart_route(context, "")  # ✅ FIXED
    except Exception as e:
        reply = f"⚠️ AI error: {e}"

    save_message(user_id, req.chat_id, "assistant", reply)

    return {
        "chat_id": req.chat_id,
        "reply": reply,
    }
def get_chat_history(user_id, chat_id):
    try:
        res = supabase.table("messages") \
            .select("*") \
            .eq("user_id", user_id) \
            .eq("chat_id", chat_id) \
            .order("created_at") \
            .execute()

        return res.data or []

    except Exception as e:
        print("Fetch error:", e)
        return []
