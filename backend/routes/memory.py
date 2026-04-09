from fastapi import APIRouter, Depends, HTTPException

from security import require_user
from utils.user_memory import repo

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


@router.get("")
def get_memory(current_user=Depends(require_user)):
    user_id = _ensure_repo_user(current_user)
    return {"memory": repo.list_memory(user_id=user_id)}
