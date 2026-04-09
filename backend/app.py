# backend/app.py
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routes import auth, chat, vision, voice, sync, memory, user_data
import nltk

app = FastAPI(
    title="Multimodal AI Assistant",
    version="1.0.0"
)

# Dynamic CORS from env var — set ALLOWED_ORIGINS on Render
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
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# NLTK downloads (cached after first run)
nltk.download("stopwords", quiet=True)
nltk.download("punkt", quiet=True)
nltk.download("wordnet", quiet=True)

# API Routers
app.include_router(chat.router,      prefix="/api/chat",    tags=["Chat"])
app.include_router(vision.router,    prefix="/api/vision",  tags=["Vision"])
app.include_router(voice.router,     prefix="/api/voice",   tags=["Voice"])
app.include_router(sync.router,      prefix="/api/sync",    tags=["Sync"])
app.include_router(memory.router,    prefix="/api/memory",  tags=["Memory"])
app.include_router(user_data.router, prefix="/api/user",    tags=["User"])
app.include_router(auth.router,      prefix="/api/auth",    tags=["Auth"])


@app.get("/health")
def health():
    return {"status": "ok"}
