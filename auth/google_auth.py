import json
import logging
import os
from typing import Any, Dict

import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials

logger = logging.getLogger(__name__)


class GoogleAuthVerifier:
    def __init__(self) -> None:
        self._initialized = False

    def _initialize(self) -> None:
        if self._initialized:
            return

        if firebase_admin._apps:
            self._initialized = True
            return

        service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
        service_account_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "").strip()

        if service_account_json:
            cred = credentials.Certificate(json.loads(service_account_json))
            firebase_admin.initialize_app(cred)
        elif service_account_path:
            cred = credentials.Certificate(service_account_path)
            firebase_admin.initialize_app(cred)
        else:
            firebase_admin.initialize_app()

        self._initialized = True

    def verify(self, id_token: str) -> Dict[str, Any]:
        self._initialize()
        try:
            decoded = firebase_auth.verify_id_token(id_token, clock_skew_seconds=10)
            logger.info("Token verified")
            return decoded
        except Exception as exc:
            logger.exception("Token verification failed: %s", exc)
            raise


verifier = GoogleAuthVerifier()
