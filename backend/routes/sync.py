# backend/routes/sync.py
from typing import Any, Dict, List, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from security import require_user
from utils.supabase_client import supabase

router = APIRouter()


def _uid(decoded: dict) -> str:
    return decoded.get("uid") or decoded.get("sub") or "demo_user"


class SyncMessage(BaseModel):
    id: str | None = None
    role: str
    content: str = ""
    source: Literal["web", "app"] = "app"
    timestamp: str | None = None


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
    user_id = _uid(current_user)
    synced = []

    if supabase:
        for chat in payload.chats:
            try:
                for msg in chat.messages:
                    supabase.table("chats").upsert({
                        "user_id": user_id,
                        "chat_id": chat.id,
                        "role": msg.role,
                        "message": msg.content,
                    }).execute()
                synced.append(chat.id)
            except Exception as e:
                print(f"Sync error for chat {chat.id}: {e}")

    return {
        "message": "Sync complete",
        "synced_chats": len(synced),
    }


@router.get("/download")
def download_sync(current_user=Depends(require_user)) -> Dict[str, Any]:
    user_id = _uid(current_user)
    data: list = []

    if supabase:
        try:
            result = supabase.table("chats").select("*").eq("user_id", user_id).execute()
            data = result.data or []
        except Exception as e:
            print(f"Sync download error: {e}")

    return {"cloud": data}
