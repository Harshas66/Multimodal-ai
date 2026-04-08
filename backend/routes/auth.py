#backend/routes/auth.py
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from backend.core.firebase_admin import verify_token, init_firebase
from backend.security import require_user
from memory.repository import repo

router = APIRouter()


class GoogleAuthRequest(BaseModel):
    id_token: str


class SessionSyncRequest(BaseModel):
    name: str = ""
    email: str = ""
    provider: str = "password"


def _uid(decoded: dict) -> str:
    return decoded.get("uid") or decoded.get("sub") or ""


def _ensure_repo_user(decoded: dict, *, fallback_name: str = "", fallback_email: str = "", fallback_provider: str = "password"):
    user_id = _uid(decoded)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid user token")
    provider = ((decoded.get("firebase") or {}).get("sign_in_provider") or fallback_provider or "password").replace(".com", "")
    email = decoded.get("email") or fallback_email
    name = decoded.get("name") or fallback_name or (email.split("@")[0] if email else "User")
    return repo.ensure_user(user_id=user_id, name=name, email=email, provider=provider)


@router.post("/google")
def google_login(payload: GoogleAuthRequest):
    try:
        init_firebase()
        decoded = verify_token(payload.id_token)
    except Exception as exc:
        print("GOOGLE AUTH ERROR:", exc)
        raise HTTPException(status_code=401, detail=str(exc))

    provider = (decoded.get("firebase") or {}).get("sign_in_provider")
    if provider != "google.com":
        raise HTTPException(status_code=403, detail="Only Google OAuth is allowed")

    user_id = _uid(decoded)
    email = decoded.get("email")
    name = decoded.get("name") or (email.split("@")[0] if email else "User")

    if not user_id or not email:
        raise HTTPException(status_code=400, detail="Google profile is missing required fields")

    user = repo.upsert_user(user_id=user_id, name=name, email=email, provider="google")

    return {
        "access_token": payload.id_token,
        "token_type": "bearer",
        "user": user,
        "session": {
            "started_at": datetime.now(timezone.utc).isoformat(),
            "provider": "google",
        },
    }


@router.get("/session")
def session(current_user=Depends(require_user)):
    user = _ensure_repo_user(current_user)
    user_id = user.get("id") or _uid(current_user)
    users = repo.export_user_data(user_id=user_id)
    return {
        "user_id": user_id,
        "email": user.get("email", current_user.get("email", "")),
        "chat_count": len(users.get("chats", [])),
    }


@router.post("/session")
def sync_session(payload: SessionSyncRequest, current_user=Depends(require_user)):
    user = _ensure_repo_user(
        current_user,
        fallback_name=payload.name,
        fallback_email=payload.email,
        fallback_provider=payload.provider,
    )
    return {"user": user}


@router.get("/profile")
def profile(current_user=Depends(require_user)):
    user = _ensure_repo_user(current_user)
    user_id = user.get("id") or _uid(current_user)
    data = repo.export_user_data(user_id=user_id)
    return {
        "user_id": user_id,
        "name": user.get("name", ""),
        "email": user.get("email", current_user.get("email", "")),
        "provider": user.get("provider", "google"),
        "created_at": user.get("created_at"),
        "chat_count": len(data.get("chats", [])),
    }


@router.post("/logout")
def logout(_: dict = Depends(require_user)):
    return {"message": "Logged out"}


@router.delete("/delete-account")
def delete_account(current_user=Depends(require_user)):
    user_id = _uid(current_user)
    repo.clear_user_data(user_id=user_id)
    repo.delete_user(user_id=user_id)
    return {"message": "Account deleted"}
