# backend/routes/chat.py

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from utils.image_analyzer import analyze_image
from utils.supabase_client import supabase
from security import require_user

# Optional import for smart routing
try:
    from orchestrator.router import smart_route
except ImportError:
    smart_route = None

router = APIRouter()   # No prefix here (we'll add it in main.py)

# Request Model
class ChatRequest(BaseModel):
    chat_id: Optional[str] = None
    message: Optional[str] = ""
    image_url: Optional[str] = None
    session_id: Optional[str] = None
    title: Optional[str] = None

# Get user ID
def _uid(user: dict) -> str:
    return user.get("id", "test-user")

# Save message helper
def save_message(user_id: str, chat_id: str, role: str, content: str):
    if not supabase:
        return
    try:
        supabase.table("messages").insert({
            "user_id": user_id,
            "chat_id": chat_id,
            "role": role,
            "content": content
        }).execute()
    except Exception:
        pass  # silent fail in production, you can log it

# Get chat history
def get_chat_history(user_id: str, chat_id: str):
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
    except Exception:
        return []

# Main endpoint
@router.post("/ask")
def ask(req: ChatRequest, current_user=Depends(require_user)):
    user_id = _uid(current_user)

    if not req.message and not req.image_url:
        raise HTTPException(status_code=400, detail="Message or image_url is required")

    # Generate or use chat_id
    chat_id = req.chat_id or f"chat_{user_id}_{int(__import__('time').time())}"

    # Save user message
    user_content = req.message or "[Image]"
    if req.image_url:
        user_content += f" (Image: {req.image_url})"
    
    save_message(user_id, chat_id, "user", user_content)

    # Get conversation history (last 20 messages)
    history = get_chat_history(user_id, chat_id) if current_user.get("memory_enabled", True) else []
    history = history[-20:]  # limit context

    context = "\n".join([f"{m['role']}: {m['content']}" for m in history])

    # Generate AI response
    try:
        if req.image_url:
            caption = analyze_image(req.image_url)
            if req.message:
                combined = f"Image description: {caption}\nUser question: {req.message}"
                reply = smart_route(combined, "") if smart_route else f"🖼️ {caption}\n\n💬 {req.message}"
            else:
                reply = f"🖼️ Image Analysis:\n{caption}"
        else:
            input_text = context + "\nuser: " + req.message
            reply = smart_route(input_text, "") if smart_route else f"Echo: {req.message}"
    except Exception as e:
        reply = f"⚠️ AI processing error: {str(e)}"

    # Save assistant reply
    save_message(user_id, chat_id, "assistant", reply)

    return {
        "success": True,
        "chat_id": chat_id,
        "reply": reply
    }


# Test route (optional)
@router.get("/")
def test_chat():
    return {"message": "Chat API is working ✅", "endpoints": ["/ask"]}
