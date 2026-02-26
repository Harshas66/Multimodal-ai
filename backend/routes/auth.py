# backend/routes/auth.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import json
import os
from fastapi import Depends, Header
from backend.auth import require_user

router = APIRouter()

# Persist users across server restarts (very important for testing!)
DB_FILE = "fake_users.json"

def load_users():
    if os.path.exists(DB_FILE):
        try:
            with open(DB_FILE, "r") as f:
                data = json.load(f)
                print(f"[DB] Loaded {len(data)} users from file")
                return data
        except Exception as e:
            print(f"[DB ERROR] Failed to load {DB_FILE}: {e}")
    print("[DB] Starting with empty user database")
    return {}

def save_users(users):
    try:
        with open(DB_FILE, "w") as f:
            json.dump(users, f, indent=2)
        print(f"[DB] Saved {len(users)} users to file")
    except Exception as e:
        print(f"[DB ERROR] Failed to save {DB_FILE}: {e}")

fake_users_db = load_users()

class LoginRequest(BaseModel):
    email: str
    password: str

class SignupRequest(BaseModel):
    name: str
    email: str
    password: str

@router.post("/signup")
async def signup(request: SignupRequest):
    email = request.email.strip().lower()  # normalize: remove spaces + lowercase
    print(f"[SIGNUP] Request received for email: '{email}' (original: '{request.email}')")

    if email in fake_users_db:
        print(f"[SIGNUP] Email already exists: {email}")
        raise HTTPException(status_code=400, detail="Email already registered")

    fake_users_db[email] = {
        "name": request.name.strip(),
        "password": request.password
    }
    save_users(fake_users_db)
    print(f"[SIGNUP] SUCCESS - User created: {email} | Current users: {list(fake_users_db.keys())}")

    return {"message": "User created successfully"}

@router.post("/login")
async def login(request: LoginRequest):
    email = request.email.strip().lower()  # same normalization
    print(f"[LOGIN] Attempting login for: '{email}' (original: '{request.email}')")
    print(f"[LOGIN] Current users in DB: {list(fake_users_db.keys())}")

    if email not in fake_users_db:
        print(f"[LOGIN] FAIL - User not found: {email}")
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user = fake_users_db[email]
    password_match = user["password"] == request.password
    print(f"[LOGIN] Password check for {email}: match = {password_match}")

    if not password_match:
        print(f"[LOGIN] FAIL - Password mismatch for {email}")
        raise HTTPException(status_code=401, detail="Invalid email or password")

    print(f"[LOGIN] SUCCESS for {email}")
    return {"token": f"fake-jwt-{email}"}

