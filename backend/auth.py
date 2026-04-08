# backend/auth.py
from fastapi import Header, HTTPException, Security
import jwt, os

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret")

def require_user(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise Exception()
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload  # return user dict
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")