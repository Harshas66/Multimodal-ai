import json
import uuid
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from typing import Generator, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from orchestrator.router import smart_route
from security import require_user
from utils.user_memory import extract_memory_facts, format_memory_context
from utils.user_memory import repo
from utils.supabase_client import supabase

router = APIRouter()


# ✅ SUPABASE SAVE FUNCTION (TOP LEVEL - CORRECT)
def save_chat_supabase(user_id, chat_id, role, message):
    try:
        supabase.table("chats").insert({
            "user_id": user_id,
            "chat_id": chat_id,
            "role": role,
            "message": message
        }).execute()
    except Exception as e:
        print("Supabase save error:", e)


class ChatRequest(BaseModel):
    chat_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: Optional[str] = None
    title: Optional[str] = "New Chat"
    message: str
    source: Literal["web", "app"] = "web"
    memory_enabled: bool = True


class RegenerateRequest(BaseModel):
    chat_id: str
    message: str
    source: Literal["web", "app"] = "web"
    memory_enabled: bool = True


class ChatRenameRequest(BaseModel):
    title: str


class SaveMessageRequest(BaseModel):
    chat_id: str
    session_id: Optional[str] = None
    title: Optional[str] = "New Chat"
    message: str
    role: Literal["user", "assistant"]
    source: Literal["web", "app"] = "web"


def _uid(decoded: dict) -> str:
    uid = decoded.get("uid") or decoded.get("sub")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid user token")
    return uid


def _ensure_repo_user(decoded: dict) -> str:
    user_id = _uid(decoded)
    provider = ((decoded.get("firebase") or {}).get("sign_in_provider") or "password").replace(".com", "")
    repo.ensure_user(
        user_id=user_id,
        email=decoded.get("email", ""),
        name=decoded.get("name") or decoded.get("email", "").split("@")[0],
        provider=provider,
    )
    return user_id


def _format_context_lines(user_id: str, enabled: bool, current_message: str = "") -> str:
    if not enabled:
        return ""

    context_sections = []
    memory_context = format_memory_context(repo.list_memory(user_id=user_id))
    if memory_context:
        context_sections.append(memory_context)

    recent = repo.recent_user_context(user_id=user_id, limit=20)
    if recent:
        lines = []
        current = (current_message or "").strip()
        for item in recent:
            role = item.get("role", "assistant")
            role_label = "User" if str(role).lower() == "user" else "Assistant"
            content = (item.get("content") or "").strip()
            if not content:
                continue
            if role == "user" and current and content == current:
                continue
            if len(content) > 280:
                content = content[:280].rstrip() + "..."
            lines.append(f"{role_label}: {content}")
        if lines:
            context_sections.append("Recent cross-chat context:\n" + "\n".join(lines[-20:]))

    if not context_sections:
        return ""

    context = "\n\n".join(context_sections)
    if len(context) > 3000:
        context = context[-3000:]
    return context


def _generate_reply(user_input: str, context: str) -> str:
    prompt = f"{context}\n\nCurrent user input:\n{user_input}" if context else user_input
    try:
        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(smart_route, prompt, user_input)
            output = future.result(timeout=35)
    except TimeoutError:
        output = "I am taking too long to respond right now. Please try again."
    except Exception as exc:
        output = f"Assistant routing error: {exc}"
    return str(output)


@router.post("/ask")
def ask(req: ChatRequest, current_user=Depends(require_user)):
    user_id = _ensure_repo_user(current_user)

    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    repo.create_chat_if_missing(
        chat_id=req.chat_id,
        user_id=user_id,
        session_id=req.session_id or req.chat_id,
        title=req.title or "New Chat",
    )

    # ✅ SAVE USER MESSAGE
    saved_user = repo.save_message(
        chat_id=req.chat_id,
        role="user",
        content=req.message,
        source=req.source,
    )

    save_chat_supabase(user_id, req.chat_id, "user", req.message)

    # Memory
    for fact in extract_memory_facts(req.message):
        repo.upsert_memory(user_id=user_id, key=fact["key"], value=fact["value"])

    # Generate AI
    context = _format_context_lines(user_id, req.memory_enabled, req.message)

    try:
        reply = _generate_reply(req.message, context)
    except Exception:
        reply = "⚠️ AI failed to generate a response."

    # ✅ SAVE AI RESPONSE
    saved_assistant = repo.save_message(
        chat_id=req.chat_id,
        role="assistant",
        content=reply,
        source=req.source,
    )

    save_chat_supabase(user_id, req.chat_id, "assistant", reply)

    return {
        "chat_id": req.chat_id,
        "reply": reply,
    }