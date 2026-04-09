# backend/core/firebase_admin.py

import json
import logging
import os

import firebase_admin
from firebase_admin import credentials, auth

logger = logging.getLogger(__name__)


def init_firebase():
    """Initialize Firebase Admin SDK safely (no crash if missing)."""
    try:
        if firebase_admin._apps:
            return

        # 1. Try env JSON
        svc_json_str = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
        if svc_json_str:
            svc_dict = json.loads(svc_json_str)
            cred = credentials.Certificate(svc_dict)
            firebase_admin.initialize_app(cred)
            logger.info("Firebase initialized from env JSON")
            return

        # 2. Try env path
        path_from_env = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "")
        if path_from_env and os.path.isfile(path_from_env):
            cred = credentials.Certificate(path_from_env)
            firebase_admin.initialize_app(cred)
            logger.info("Firebase initialized from env path")
            return

        # 3. Try local file
        base_dir = os.path.dirname(os.path.abspath(__file__))
        local_path = os.path.join(base_dir, "firebase-service-account.json")
        if os.path.isfile(local_path):
            cred = credentials.Certificate(local_path)
            firebase_admin.initialize_app(cred)
            logger.info("Firebase initialized from local file")
            return

        # No credentials → continue safely
        logger.warning("⚠️ Firebase not configured — running without auth")

    except Exception as exc:
        logger.error("❌ Firebase init failed: %s", exc)
        # DO NOT crash app


def verify_token(token: str) -> dict:
    """Safe token verification (no crash if Firebase not configured)."""
    try:
        if not firebase_admin._apps:
            print("⚠️ Firebase not initialized, returning dummy user")
            return {"uid": "demo_user"}

        decoded_token = auth.verify_id_token(token, clock_skew_seconds=10)
        return decoded_token

    except Exception as exc:
        print("Token verification failed:", exc)
        return {"uid": "demo_user"}