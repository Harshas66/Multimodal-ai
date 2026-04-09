# backend/routes/chat.py

import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from orchestrator.router import smart_route
from security import require_user
from utils.supabase_client import supabase

router = APIRouter()


def save_chat_supabase(user_id, chat_id, role, message):
    try:
        if not supabase:
            return

        supabase.table("chats").insert({
            "user_id": user_id,
            "chat_id": chat_id,
            "role": role,
            "message": message
        }).execute()

    except Exception as e:
        print("Supabase error:", e)


class ChatRequest(BaseModel):
    chat_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    message: str


def _uid(decoded: dict) -> str:
    return decoded.get("uid", "demo_user")


@router.post("/ask")
def ask(req: ChatRequest, current_user=Depends(require_user)):

    user_id = _uid(current_user)

    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    # Save user message
    save_chat_supabase(user_id, req.chat_id, "user", req.message)

    # Generate AI response
    try:
        reply = smart_route(req.message, req.message)
    except Exception as e:
        reply = f"⚠️ AI error: {e}"

    # Save AI response
    save_chat_supabase(user_id, req.chat_id, "assistant", reply)

    return {
        "chat_id": req.chat_id,
        "reply": reply,
    }