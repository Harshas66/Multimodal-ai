# backend/security.py

from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from utils.supabase_client import supabase

security = HTTPBearer()


def require_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials

        user_response = supabase.auth.get_user(token)

        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Authentication failed")

        return user_response.user.model_dump()

    except Exception as e:
        print("Auth error:", e)
        raise HTTPException(status_code=401, detail="Authentication failed")
