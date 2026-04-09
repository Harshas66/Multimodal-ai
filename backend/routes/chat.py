# backend/routes/chat.py

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from orchestrator.router import smart_route
from security import require_user
from utils.supabase_client import supabase

router = APIRouter()


# ✅ REQUEST MODEL (UPDATED)
class ChatRequest(BaseModel):
    chat_id: str
    message: str
    session_id: Optional[str] = None
    title: Optional[str] = None


# ✅ GET USER ID
def _uid(user: dict) -> str:
    if not user or "id" not in user:
        raise HTTPException(status_code=401, detail="Invalid user")
    return user["id"]


# ✅ VERIFY OR CREATE CHAT
def verify_or_create_chat(user_id, chat_id, title=None):
    try:
        res = supabase.table("chats") \
            .select("id, user_id") \
            .eq("id", chat_id) \
            .execute()

        # Chat exists
        if res.data:
            if res.data[0]["user_id"] != user_id:
                return False
            return True

        # Create new chat
        supabase.table("chats").insert({
            "id": chat_id,
            "user_id": user_id,
            "title": title or "New Chat"
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


# ✅ GET CHAT HISTORY (MESSAGES)
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
        print("❌ Fetch error:", e)
        return []


# 🚀 MAIN API: ASK
@router.post("/ask")
def ask(req: ChatRequest, current_user=Depends(require_user)):

    user_id = _uid(current_user)

    if not req.chat_id:
        raise HTTPException(status_code=400, detail="chat_id is required")

    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    print("👤 USER:", user_id)
    print("💬 CHAT:", req.chat_id)

    # ✅ VERIFY / CREATE CHAT
    if not verify_or_create_chat(user_id, req.chat_id, req.title):
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


# 🚀 GET FULL CHAT HISTORY (WITH MESSAGES)
@router.get("/history")
def get_history(current_user=Depends(require_user)):

    user_id = _uid(current_user)

    try:
        # Get chats
        chats_res = supabase.table("chats") \
            .select("*") \
            .eq("user_id", user_id) \
            .order("created_at", desc=True) \
            .execute()

        chats = chats_res.data or []

        # Attach messages
        for chat in chats:
            msg_res = supabase.table("messages") \
                .select("*") \
                .eq("chat_id", chat["id"]) \
                .eq("user_id", user_id) \
                .order("created_at") \
                .execute()

            chat["messages"] = msg_res.data or []

        return {"chats": chats}

    except Exception as e:
        print("❌ History error:", e)
        raise HTTPException(status_code=500, detail="Failed to fetch history")


# 🚀 DELETE CHAT
@router.delete("/{chat_id}")
def delete_chat(chat_id: str, current_user=Depends(require_user)):

    user_id = _uid(current_user)

    try:
        # Check ownership
        res = supabase.table("chats") \
            .select("id") \
            .eq("id", chat_id) \
            .eq("user_id", user_id) \
            .execute()

        if not res.data:
            raise HTTPException(status_code=403, detail="Unauthorized")

        # Delete messages
        supabase.table("messages") \
            .delete() \
            .eq("chat_id", chat_id) \
            .eq("user_id", user_id) \
            .execute()

        # Delete chat
        supabase.table("chats") \
            .delete() \
            .eq("id", chat_id) \
            .eq("user_id", user_id) \
            .execute()

        return {"message": "Chat deleted"}

    except Exception as e:
        print("❌ Delete error:", e)
        raise HTTPException(status_code=500, detail="Delete failed")


# 🚀 RENAME CHAT
@router.patch("/{chat_id}")
def rename_chat(chat_id: str, body: dict, current_user=Depends(require_user)):

    user_id = _uid(current_user)
    title = body.get("title", "").strip()

    if not title:
        raise HTTPException(status_code=400, detail="Title required")

    try:
        res = supabase.table("chats") \
            .update({"title": title}) \
            .eq("id", chat_id) \
            .eq("user_id", user_id) \
            .execute()

        if not res.data:
            raise HTTPException(status_code=403, detail="Unauthorized")

        return {"message": "Chat renamed"}

    except Exception as e:
        print("❌ Rename error:", e)
        raise HTTPException(status_code=500, detail="Rename failed")
