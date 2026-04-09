import os
from dotenv import load_dotenv


def load_env():
    """
    Load .env file — works for both local dev and Render (where rootDir=backend).
    Search order:
      1. backend/.env          (local dev with backend as CWD)
      2. <project_root>/.env   (local dev with project root as CWD)
    On Render, env vars are injected directly — no .env file needed.
    """
    # backend/utils/env_loader.py is 2 levels inside backend/
    this_dir = os.path.dirname(os.path.abspath(__file__))       # backend/utils/
    backend_dir = os.path.dirname(this_dir)                      # backend/
    project_root = os.path.dirname(backend_dir)                  # project root

    candidates = [
        os.path.join(backend_dir, ".env"),    # backend/.env
        os.path.join(project_root, ".env"),   # <root>/.env
        os.path.join(os.getcwd(), ".env"),     # CWD/.env (fallback)
    ]

    for env_path in candidates:
        if os.path.exists(env_path):
            load_dotenv(env_path, override=False)
            print(f"✅ .env loaded from: {env_path}")
            return

    print("ℹ️  No .env file found — using environment variables directly (Render/production mode).")
