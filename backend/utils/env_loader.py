#backend/ utils/env_loader.py
import os
from dotenv import load_dotenv

def load_env():
    # Always load from project root (where main.py is)
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    if os.path.exists(env_path):
        load_dotenv(env_path, override=True)
        print(f"✅ .env loaded from: {env_path}")
    else:
        print("⚠️ .env file not found — check project root.")
