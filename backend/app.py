import os

# Load .env for local development (Render injects env vars directly)
try:
    from dotenv import load_dotenv
    # Try backend/.env first, then fall back to project root .env
    _backend_env = os.path.join(os.path.dirname(__file__), ".env")
    _root_env = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    if os.path.exists(_backend_env):
        load_dotenv(_backend_env, override=False)
        print(f"✅ .env loaded from: {_backend_env}")
    elif os.path.exists(_root_env):
        load_dotenv(_root_env, override=False)
        print(f"✅ .env loaded from: {_root_env}")
except Exception as _e:
    print(f"⚠️ dotenv load skipped: {_e}")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import nltk

app = FastAPI(
    title="Multimodal AI Assistant",
    version="1.0.0"
)

# ── CORS ──────────────────────────────────────────────────────
_origins_env = os.getenv("ALLOWED_ORIGINS", "")
origins = [o.strip() for o in _origins_env.split(",") if o.strip()]
origins += [
    "http://localhost:3000",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── NLTK ──────────────────────────────────────────────────────
try:
    nltk.download("stopwords", quiet=True)
    nltk.download("punkt", quiet=True)
    nltk.download("wordnet", quiet=True)
except Exception as _nltk_err:
    print(f"⚠️ NLTK download warning: {_nltk_err}")

# ── Routers ───────────────────────────────────────────────────
# Import each router individually with error isolation so a
# failing optional route never crashes the whole app.
from routes import auth  # noqa: E402

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])

_optional_routers = [
    ("routes.chat",      "/api/chat",   "Chat"),
    ("routes.vision",    "/api/vision", "Vision"),
    ("routes.voice",     "/api/voice",  "Voice"),
    ("routes.sync",      "/api/sync",   "Sync"),
    ("routes.memory",    "/api/memory", "Memory"),
    ("routes.user_data", "/api/user",   "UserData"),
]

for _mod, _prefix, _tag in _optional_routers:
    try:
        import importlib
        _m = importlib.import_module(_mod)
        app.include_router(_m.router, prefix=_prefix, tags=[_tag])
        print(f"✅ Router registered: {_prefix}")
    except Exception as _e:
        print(f"⚠️ Skipping router {_prefix}: {_e}")


# ── Health ────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"message": "Backend is running 🚀"}


@app.get("/health")
def health():
    return {"status": "ok"}