# backend/auth.py
# Accepts both Firebase ID tokens (sent by frontend) and local JWT tokens.

import os
from fastapi import Header, HTTPException

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret")


def require_user(authorization: str = Header(None)):
    """
    Accept Firebase ID token OR a locally-signed JWT.
    Returns a dict with at least a 'uid' key.
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid Authorization format")

    token = parts[1]

    # ── 1. Try Firebase verification first (tokens from frontend) ──
    try:
        from core.firebase_admin import init_firebase, verify_token
        init_firebase()
        decoded = verify_token(token)
        if decoded and decoded.get("uid") and decoded["uid"] != "demo_user":
            return decoded
    except Exception:
        pass

    # ── 2. Try local JWT (tokens issued by this backend) ──────────
    try:
        import jwt
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except Exception:
        pass

    # ── 3. Fallback: lenient demo mode for development ──────────
    # Remove this block in production if you want strict auth:
    if os.getenv("AUTH_STRICT", "").lower() not in ("1", "true", "yes"):
        return {"uid": "demo_user", "email": "demo@example.com"}

    raise HTTPException(status_code=401, detail="Invalid or expired token")