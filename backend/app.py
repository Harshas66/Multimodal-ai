from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.routes import auth, chat, sentiment, sync, vision, voice

app = FastAPI(title="Multimodal AI Assistant", version="2.0.0")

allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(sync.router, prefix="/api/sync", tags=["Sync"])
app.include_router(vision.router, prefix="/api/vision", tags=["Vision"])
app.include_router(voice.router, prefix="/api/voice", tags=["Voice"])
app.include_router(sentiment.router, prefix="/api/sentiment", tags=["Sentiment"])


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


frontend_dir = Path(__file__).resolve().parents[1] / "frontend"
if frontend_dir.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")
