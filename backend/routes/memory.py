# backend/routes/memory.py
from fastapi import APIRouter, Depends
from security import require_user
from utils.user_memory import extract_memory_facts

router = APIRouter()


def _uid(decoded: dict) -> str:
    return decoded.get("uid") or decoded.get("sub") or "demo_user"


@router.get("")
def get_memory(current_user=Depends(require_user)):
    # Memory is stored client-side (localStorage) in this deployment.
    # Server-side memory persistence can be added via Supabase later.
    return {"memory": [], "user_id": _uid(current_user)}
