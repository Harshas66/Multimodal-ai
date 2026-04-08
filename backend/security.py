import logging

from fastapi import Header, HTTPException

from auth.google_auth import verifier

logger = logging.getLogger(__name__)


def require_user(authorization: str = Header(None, alias="Authorization")) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        decoded = verifier.verify(token)
        logger.info("Token verified")
        return decoded
    except Exception as exc:
        logger.exception("Token verification failed in require_user: %s", exc)
        raise HTTPException(status_code=401, detail=f"Authentication required: {exc}")
