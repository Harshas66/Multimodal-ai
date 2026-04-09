# backend/routes/chat.py

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from orchestrator.router import smart_route
from security import require_user
from utils.supabase_client import supabase

router = APIRouter()


class ChatRequest(BaseModel):
    chat_id: str
    message: str


def _uid(decoded: dict) -> str:
    return decoded.get("uid", "demo_user")


# ✅ VERIFY CHAT BELONGS TO USER (CRITICAL 🔥)
def verify_chat_ownership(user_id, chat_id):
    try:
        res = supabase.table("chats") \
            .select("id") \
            .eq("id", chat_id) \
            .eq("user_id", user_id) \
            .execute()

        return bool(res.data)
    except Exception as e:
        print("Ownership check error:", e)
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
        print("Supabase insert error:", e)


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
        print("Fetch error:", e)
        return []


# 🚀 MAIN API
@router.post("/ask")
def ask(req: ChatRequest, current_user=Depends(require_user)):

    user_id = _uid(current_user)

    # ✅ VALIDATIONS
    if not req.chat_id:
        raise HTTPException(status_code=400, detail="chat_id is required")

    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    print("USER:", user_id, "CHAT:", req.chat_id)

    # 🔥 CRITICAL: CHECK OWNERSHIP
    if not verify_chat_ownership(user_id, req.chat_id):
        raise HTTPException(status_code=403, detail="Unauthorized chat access")

    # ✅ SAVE USER MESSAGE
    save_message(user_id, req.chat_id, "user", req.message)

    # ✅ FETCH HISTORY (ONLY THIS USER + CHAT)
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
