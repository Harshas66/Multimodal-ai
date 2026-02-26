#backend/routes/sentiment.py
from fastapi import APIRouter, Request
from backend.agents.sentiment_agent import handle

router = APIRouter()

@router.post("/sentiment")
async def detect_emotion(request: Request):
    data = await request.json()
    text = data.get("text", "")
    response = handle(text)
    return {"emotion_reply": response}