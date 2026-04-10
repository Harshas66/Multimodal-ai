# backend/routes/user_data.py
from fastapi import APIRouter, Depends
from security import require_user
from utils.supabase_client import supabase

router = APIRouter()


# ✅ CONSISTENT USER ID
def _uid(user: dict) -> str:
    return user.get("id") or user.get("uid") or user.get("sub") or "demo_user"


# ✅ EXPORT USER DATA
@router.get("/data")
def export_user_data(current_user=Depends(require_user)):
    user_id = _uid(current_user)

    data = []
    if supabase:
        try:
            result = supabase.table("chats") \
                .select("*") \
                .eq("user_id", user_id) \
                .execute()

            data = result.data or []

        except Exception as e:
            print(f"Export error: {e}")

    return {
        "user_id": user_id,
        "chats": data
    }


# ✅ CLEAR USER DATA
@router.delete("/data")
def clear_user_data(current_user=Depends(require_user)):
    user_id = _uid(current_user)

    if supabase:
        try:
            supabase.table("messages").delete().eq("user_id", user_id).execute()
            supabase.table("chats").delete().eq("user_id", user_id).execute()
        except Exception as e:
            print(f"Clear error: {e}")

    return {"message": "All user data deleted"}


# ✅ TOGGLE MEMORY (MAIN FEATURE 🔥)
@router.post("/memory")
def toggle_memory(body: dict, current_user=Depends(require_user)):
    user_id = _uid(current_user)
    enabled = body.get("enabled", True)

    if supabase:
        try:
            supabase.table("users").update({
                "memory_enabled": enabled
            }).eq("id", user_id).execute()
        except Exception as e:
            print(f"Memory toggle error: {e}")

    return {
        "memory_enabled": enabled
    }


# ✅ GET MEMORY STATUS (IMPORTANT FOR UI)
@router.get("/memory")
def get_memory_status(current_user=Depends(require_user)):
    user_id = _uid(current_user)

    enabled = True  # default

    if supabase:
        try:
            res = supabase.table("users") \
                .select("memory_enabled") \
                .eq("id", user_id) \
                .execute()

            if res.data:
                enabled = res.data[0].get("memory_enabled", True)

        except Exception as e:
            print(f"Memory fetch error: {e}")

    return {
        "memory_enabled": enabled
    }
