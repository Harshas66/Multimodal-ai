#backend/routes/chat.py
import json
import uuid
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from typing import Generator, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from backend.orchestrator.router import smart_route
from backend.security import require_user
from memory.repository import repo

router = APIRouter()


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


def _uid(decoded: dict) -> str:
    uid = decoded.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid user token")
    return uid


def _format_context_lines(user_id: str, enabled: bool, current_message: str = "") -> str:
    if not enabled:
        return ""

    recent = repo.recent_user_context(user_id=user_id, limit=20)
    if not recent:
        return ""

    lines = []
    current = (current_message or "").strip()
    for item in recent:
        role = item.get("role", "assistant")
        role_label = "User" if str(role).lower() == "user" else "Assistant"
        content = (item.get("content") or "").strip()
        if not content:
            continue
        # Avoid duplicating the current user query into memory context.
        if role == "user" and current and content == current:
            continue
        # Keep memory context bounded to avoid oversized downstream prompts/tools.
        if len(content) > 280:
            content = content[:280].rstrip() + "..."
        lines.append(f"{role_label}: {content}")

    if not lines:
        return ""

    context_lines = lines[-20:]
    context = "Use this memory context across chats for continuity:\n" + "\n".join(context_lines)
    if len(context) > 3000:
        context = context[-3000:]
    return context


def _generate_reply(user_input: str, context: str) -> str:
    prompt = f"{context}\n\nCurrent user input:\n{user_input}" if context else user_input
    try:
        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(smart_route, prompt)
            output = future.result(timeout=35)
    except TimeoutError:
        output = "I am taking too long to respond right now. Please try again."
    except Exception as exc:
        output = f"Assistant routing error: {exc}"
    if isinstance(output, dict):
        return json.dumps(output, ensure_ascii=False)
    return str(output)


@router.post("/ask")
def ask(req: ChatRequest, current_user=Depends(require_user)):
    user_id = _uid(current_user)
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    repo.create_chat_if_missing(
        chat_id=req.chat_id,
        user_id=user_id,
        session_id=req.session_id or req.chat_id,
        title=req.title or "New Chat",
    )

    saved_user = repo.save_message(
        chat_id=req.chat_id,
        role="user",
        content=req.message,
        source=req.source,
    )

    context = _format_context_lines(user_id=user_id, enabled=req.memory_enabled, current_message=req.message)
    try:
        reply = _generate_reply(req.message, context)
    except Exception as e:
        print("Generation error:", e)
        reply = "⚠️ AI failed to generate a response."

    saved_assistant = repo.save_message(
        chat_id=req.chat_id,
        role="assistant",
        content=reply,
        source=req.source,
    )

    return {
        "chat_id": req.chat_id,
        "user_message": saved_user,
        "assistant_message": saved_assistant,
        "reply": reply,
    }


@router.post("/stream")
def stream(req: ChatRequest, current_user=Depends(require_user)):
    user_id = _uid(current_user)
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    repo.create_chat_if_missing(
        chat_id=req.chat_id,
        user_id=user_id,
        session_id=req.session_id or req.chat_id,
        title=req.title or "New Chat",
    )
    repo.save_message(chat_id=req.chat_id, role="user", content=req.message, source=req.source)

    context = _format_context_lines(user_id=user_id, enabled=req.memory_enabled, current_message=req.message)
    try:
        reply = _generate_reply(req.message, context)
    except Exception:
        reply = "I could not generate a response right now. Please try again."
    saved_assistant = repo.save_message(chat_id=req.chat_id, role="assistant", content=reply, source=req.source)

    def event_stream() -> Generator[str, None, None]:
        yield f"data: {json.dumps({'type': 'meta', 'chat_id': req.chat_id, 'assistant_message_id': saved_assistant['id']})}\n\n"
        chunk_size = 42
        for idx in range(0, len(reply), chunk_size):
            chunk = reply[idx:idx + chunk_size]
            yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/regenerate")
def regenerate(req: RegenerateRequest, current_user=Depends(require_user)):
    user_id = _uid(current_user)
    repo.create_chat_if_missing(chat_id=req.chat_id, user_id=user_id, session_id=req.chat_id, title="New Chat")

    context = _format_context_lines(user_id=user_id, enabled=req.memory_enabled, current_message=req.message)
    try:
        reply = _generate_reply(req.message, context)
    except Exception:
        reply = "I could not generate a response right now. Please try again."
    saved_assistant = repo.save_message(
        chat_id=req.chat_id,
        role="assistant",
        content=reply,
        source=req.source,
    )
    return {"assistant_message": saved_assistant, "reply": reply}


@router.get("/history")
def history(search: str = Query(default=""), current_user=Depends(require_user)):
    return {"chats": repo.list_chats(user_id=_uid(current_user), search=search)}


@router.get("/{chat_id}/messages")
def messages(chat_id: str, current_user=Depends(require_user)):
    user_chats = {item["id"] for item in repo.list_chats(user_id=_uid(current_user))}
    if chat_id not in user_chats:
        raise HTTPException(status_code=404, detail="Chat not found")
    return {"messages": repo.list_messages(chat_id=chat_id)}


@router.patch("/{chat_id}")
def rename_chat(chat_id: str, payload: ChatRenameRequest, current_user=Depends(require_user)):
    repo.rename_chat(chat_id=chat_id, user_id=_uid(current_user), title=payload.title)
    return {"message": "Chat title updated"}


@router.delete("/{chat_id}")
def delete_chat(chat_id: str, current_user=Depends(require_user)):
    repo.delete_chat(chat_id=chat_id, user_id=_uid(current_user))
    return {"message": "Chat deleted"}
