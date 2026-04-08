from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from fastapi import FastAPI
from backend.routes.auth import router as auth_router

app = FastAPI()

# ✅ NO PREFIX HERE
app.include_router(auth_router)



# Add this import
from backend.routes import auth

from backend.routes import chat, vision, voice, sync, memory, user_data
import nltk

app = FastAPI(
    title="Multimodal AI Assistant",
    version="1.0.0"
)

# ✅ CORS (safe default)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # OK for local/demo
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ NLTK downloads (safe, cached)
nltk.download("stopwords")
nltk.download("punkt")
nltk.download("wordnet")

# ✅ API Routers
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(vision.router, prefix="/api/vision", tags=["Vision"])
app.include_router(voice.router, prefix="/api/voice", tags=["Voice"])
app.include_router(sync.router, prefix="/api/sync", tags=["Sync"])
app.include_router(memory.router, prefix="/api/memory", tags=["Memory"])
app.include_router(user_data.router, prefix="/api/user", tags=["User"])

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])

# ✅ Health check
@app.get("/health")
def health():
    return {"status": "ok"}

# ✅ SERVE FRONTEND (THIS FIXES YOUR 404)
app.mount(
    "/", 
    StaticFiles(directory="frontend", html=True), 
    name="frontend"
)
