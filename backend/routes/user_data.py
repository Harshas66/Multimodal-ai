from fastapi import APIRouter, Depends, HTTPException

from backend.security import require_user
from memory.repository import repo

router = APIRouter()


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


@router.get("/data")
def export_user_data(current_user=Depends(require_user)):
    user_id = _ensure_repo_user(current_user)
    return repo.export_user_data(user_id=user_id)


@router.delete("/data")
def clear_user_data(current_user=Depends(require_user)):
    user_id = _ensure_repo_user(current_user)
    repo.clear_user_data(user_id=user_id)
    return {"message": "All user data deleted"}
