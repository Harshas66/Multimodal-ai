#backend/core/firebase_admin.py
from fastapi import Header, HTTPException
import firebase_admin
from firebase_admin import credentials, auth
import os

# Initialize Firebase Admin only once
if not firebase_admin._apps:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    SERVICE_ACCOUNT_PATH = os.path.join(BASE_DIR, "firebase-service-account.json")

    cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
    firebase_admin.initialize_app(cred)


def verify_firebase_token(Authorization: str = Header(None)):
    if not Authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    try:
        scheme, token = Authorization.split()

        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid auth scheme")

        decoded_token = auth.verify_id_token(token)

        return decoded_token

    except Exception as e:
        print("TOKEN ERROR:", e)
        raise HTTPException(status_code=401, detail="Invalid or expired token")