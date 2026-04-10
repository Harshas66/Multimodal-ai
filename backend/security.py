#backend/security.py
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import firebase_admin
from firebase_admin import credentials, auth

from utils.supabase_client import supabase

# 🔥 Load Firebase key
cred = credentials.Certificate("backend/firebase_key.json")

try:
    firebase_admin.get_app()
except:
    firebase_admin.initialize_app(cred)

security = HTTPBearer()


def require_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials

        print("🔑 TOKEN:", token[:20], "...")

        decoded_token = auth.verify_id_token(token)

        user_id = decoded_token["uid"]
        email = decoded_token.get("email")

        print("✅ USER:", user_id)

        # 🔥 FETCH / CREATE USER + MEMORY FLAG
        memory_enabled = True

        if supabase:
            try:
                res = supabase.table("users") \
                    .select("memory_enabled") \
                    .eq("id", user_id) \
                    .execute()

                if res.data:
                    memory_enabled = res.data[0].get("memory_enabled", True)
                else:
                    # ✅ Create user if not exists
                    supabase.table("users").insert({
                        "id": user_id,
                        "email": email,
                        "memory_enabled": True
                    }).execute()

                    memory_enabled = True

            except Exception as e:
                print("❌ Supabase error:", e)

        # ✅ 🔥 RETURN MUST BE INSIDE FUNCTION
        return {
            "id": user_id,
            "email": email,
            "memory_enabled": memory_enabled
        }

    except Exception as e:
        print("❌ Firebase auth error:", e)
        raise HTTPException(status_code=401, detail="Authentication failed")
