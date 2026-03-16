from fastapi import Header, HTTPException

from auth.google_auth import verifier


def require_user(authorization: str = Header(None, alias="Authorization")) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        decoded = verifier.verify(token)
        return decoded
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Authentication required") from exc
