#backend/core/firebase_admin.py
import json
import logging
import os

import firebase_admin
from firebase_admin import credentials, auth

logger = logging.getLogger(__name__)


def init_firebase():
    """Initialize Firebase Admin SDK — reads credentials from env or file."""
    if firebase_admin._apps:
        return  # already initialized

    # 1. Prefer JSON string from environment variable (for Render/cloud deployments)
    svc_json_str = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
    if svc_json_str:
        try:
            svc_dict = json.loads(svc_json_str)
            cred = credentials.Certificate(svc_dict)
            firebase_admin.initialize_app(cred)
            logger.info("Firebase initialized from FIREBASE_SERVICE_ACCOUNT_JSON env var")
            return
        except Exception as exc:
            logger.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON: %s", exc)
            raise

    # 2. Fall back to service account file path
    path_from_env = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "")
    if path_from_env and os.path.isfile(path_from_env):
        cred = credentials.Certificate(path_from_env)
        firebase_admin.initialize_app(cred)
        logger.info("Firebase initialized from FIREBASE_SERVICE_ACCOUNT_PATH: %s", path_from_env)
        return

    # 3. Last resort: look next to this file
    base_dir = os.path.dirname(os.path.abspath(__file__))
    local_path = os.path.join(base_dir, "firebase-service-account.json")
    if os.path.isfile(local_path):
        cred = credentials.Certificate(local_path)
        firebase_admin.initialize_app(cred)
        logger.info("Firebase initialized from local file: %s", local_path)
        return

    raise RuntimeError(
        "Firebase credentials not found. Set FIREBASE_SERVICE_ACCOUNT_JSON env var "
        "or FIREBASE_SERVICE_ACCOUNT_PATH, or place firebase-service-account.json "
        "in backend/core/."
    )


def verify_token(token: str) -> dict:
    """Verify a Firebase ID token and return the decoded payload."""
    try:
        decoded_token = auth.verify_id_token(token, clock_skew_seconds=10)
        return decoded_token
    except Exception as exc:
        logger.exception("Token verification failed: %s", exc)
        raise
