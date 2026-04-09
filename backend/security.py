# backend/security.py

from fastapi import Header

def require_user(authorization: str = Header(None, alias="Authorization")) -> dict:
    # ✅ Temporary safe user (no Firebase dependency)
    return {"uid": "demo_user"}