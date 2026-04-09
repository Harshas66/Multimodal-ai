import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import auth, chat, vision, voice, sync, memory, user_data
import nltk

app = FastAPI(
    title="Multimodal AI Assistant",
    version="1.0.0"
)

# Dynamic CORS from env var
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
    allow_origins=origins if origins else ["*"],  # safe fallback
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# NLTK downloads (cached)
nltk.download("stopwords", quiet=True)
nltk.download("punkt", quiet=True)
nltk.download("wordnet", quiet=True)

# Routers
try:
    app.include_router(chat.router, prefix="/api/chat")
    app.include_router(vision.router, prefix="/api/vision")
    app.include_router(voice.router, prefix="/api/voice")
    app.include_router(sync.router, prefix="/api/sync")
    app.include_router(memory.router, prefix="/api/memory")
    app.include_router(user_data.router, prefix="/api/user")
    app.include_router(auth.router, prefix="/api/auth")
except Exception as e:
    print("🚨 ROUTER ERROR:", e)


@app.get("/")
def root():
    return {"message": "Backend is running 🚀"}


@app.get("/health")
def health():
    return {"status": "ok"}