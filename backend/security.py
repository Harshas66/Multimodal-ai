# backend/security.py

from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import firebase_admin
from firebase_admin import credentials, auth

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

        print("🔑 TOKEN:", token[:20], "...")  # debug

        decoded_token = auth.verify_id_token(token)

        print("✅ USER:", decoded_token)

        return {
            "id": decoded_token["uid"],   # 🔥 IMPORTANT
            "email": decoded_token.get("email")
        }

    except Exception as e:
        print("❌ Firebase auth error:", e)
        raise HTTPException(status_code=401, detail="Authentication failed")
