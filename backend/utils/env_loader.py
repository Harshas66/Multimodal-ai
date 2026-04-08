import os
from dotenv import load_dotenv


def load_env():
    # Load from project root: <root>/backend/utils/env_loader.py -> <root>/.env
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    env_path = os.path.join(project_root, ".env")
    if os.path.exists(env_path):
        load_dotenv(env_path, override=True)
        print(f".env loaded from: {env_path}")
    else:
        print(".env file not found at project root.")
