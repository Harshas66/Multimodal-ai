from typing import Any, Dict, List, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from backend.security import require_user
from memory.repository import repo

router = APIRouter()


def _uid(decoded: dict) -> str:
    return decoded.get("uid") or decoded.get("sub") or ""


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
    merged = repo.sync_payload(user_id=_uid(current_user), chats=[chat.model_dump() for chat in payload.chats], source=payload.source)
    return {
        "message": "Sync complete",
        "cloud": merged,
    }


@router.get("/download")
def download_sync(current_user=Depends(require_user)) -> Dict[str, Any]:
    data = repo.export_user_data(user_id=_uid(current_user))
    return {
        "cloud": data,
    }
