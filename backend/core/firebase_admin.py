#backend/core/firebase_admin.py
'''from fastapi import Header, HTTPException
import os
import logging

import firebase_admin
from firebase_admin import credentials, auth

logger = logging.getLogger(__name__)

# Initialize Firebase Admin only once
if not firebase_admin._apps:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    SERVICE_ACCOUNT_PATH = os.path.join(BASE_DIR, "firebase-service-account.json")

    cred = credentials.Certificate("firebase-service-account.json")
    firebase_admin.initialize_app(cred)


def verify_firebase_token(Authorization: str = Header(None)):
    if not Authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    try:
        scheme, token = Authorization.split()

        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid auth scheme")

        decoded_token = auth.verify_id_token(token, clock_skew_seconds=10)

        return decoded_token

    except Exception as e:
        print("TOKEN ERROR:", e)
        raise HTTPException(status_code=401, detail="Invalid or expired token")'''
        
        

# backend/core/firebase_admin.py

import firebase_admin
from firebase_admin import credentials, auth
import os


def init_firebase():

    if not firebase_admin._apps:

        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        key_path = os.path.join(base_dir, "firebase-service-account.json")

        cred = credentials.Certificate(key_path)

        firebase_admin.initialize_app(cred)


def verify_token(token: str):
    try:
        decoded_token = auth.verify_id_token(token, clock_skew_seconds=10)
        logger.info("Token verified")
        return decoded_token
    except Exception as exc:
        logger.exception("Token verification failed: %s", exc)
        raise
