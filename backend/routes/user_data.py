# backend/routes/user_data.py
from fastapi import APIRouter, Depends
from security import require_user
from utils.supabase_client import supabase

router = APIRouter()


def _uid(decoded: dict) -> str:
    return decoded.get("uid") or decoded.get("sub") or "demo_user"


@router.get("/data")
def export_user_data(current_user=Depends(require_user)):
    user_id = _uid(current_user)
    data = []
    if supabase:
        try:
            result = supabase.table("chats").select("*").eq("user_id", user_id).execute()
            data = result.data or []
        except Exception as e:
            print(f"Export error: {e}")
    return {"user_id": user_id, "chats": data}


@router.delete("/data")
def clear_user_data(current_user=Depends(require_user)):
    user_id = _uid(current_user)
    if supabase:
        try:
            supabase.table("chats").delete().eq("user_id", user_id).execute()
        except Exception as e:
            print(f"Clear error: {e}")
    return {"message": "All user data deleted"}
