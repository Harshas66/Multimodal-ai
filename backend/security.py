# backend/security.py

from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import firebase_admin
from firebase_admin import auth as firebase_auth

security = HTTPBearer()

# Initialize Firebase (only once)
try:
    firebase_admin.get_app()
except:
    firebase_admin.initialize_app()


def require_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials

        decoded_token = firebase_auth.verify_id_token(token)

        return {
            "id": decoded_token["uid"],   # 🔥 IMPORTANT
            "email": decoded_token.get("email")
        }

    except Exception as e:
        print("Firebase auth error:", e)
        raise HTTPException(status_code=401, detail="Authentication failed")
