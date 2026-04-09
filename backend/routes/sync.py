#backend/routes/sync.py
from typing import Any, Dict, List, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from security import require_user
from memory.repository import repo

router = APIRouter()


def _uid(decoded: dict) -> str:
    return decoded.get("uid") or decoded.get("sub") or ""


def _ensure_repo_user(decoded: dict) -> str:
    user_id = _uid(decoded)
    repo.ensure_user(
        user_id=user_id,
        email=decoded.get("email", ""),
        name=decoded.get("name") or decoded.get("email", "").split("@")[0],
        provider=((decoded.get("firebase") or {}).get("sign_in_provider") or "password").replace(".com", ""),
    )
    return user_id


class SyncMessage(BaseModel):
    id: str | None = None
    role: str
    content: str = ""
    source: Literal["web", "app"] = "app"
    timestamp: str | None = None
    embedding: List[float] = Field(default_factory=list)


class SyncChat(BaseModel):
    id: str
    session_id: str | None = None
    title: str = "New Chat"
    messages: List[SyncMessage] = Field(default_factory=list)


class SyncRequest(BaseModel):
    source: Literal["web", "app"] = "app"
    chats: List[SyncChat] = Field(default_factory=list)


@router.post("/manual")
def manual_sync(payload: SyncRequest, current_user=Depends(require_user)) -> Dict[str, Any]:
    merged = repo.sync_payload(user_id=_ensure_repo_user(current_user), chats=[chat.model_dump() for chat in payload.chats], source=payload.source)
    return {
        "message": "Sync complete",
        "cloud": merged,
    }


@router.get("/download")
def download_sync(current_user=Depends(require_user)) -> Dict[str, Any]:
    data = repo.export_user_data(user_id=_ensure_repo_user(current_user))
    return {
        "cloud": data,
    }
