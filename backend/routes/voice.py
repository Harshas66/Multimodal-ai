# backend/routes/voice.py

from fastapi import APIRouter, Body
from pydantic import BaseModel

from integrations.hf_integration import hf_simple_response

router = APIRouter()


# ✅ Request model
class VoiceRequest(BaseModel):
    user_id: str
    chat_id: str
    text: str  # ✅ Instead of microphone


# ✅ Response model
class VoiceResponse(BaseModel):
    text: str
    reply: str


@router.post("/speak", response_model=VoiceResponse)
async def speak(req: VoiceRequest = Body(default=None)):

    # ✅ Safety check
    if req is None or not req.user_id or not req.chat_id or not req.text:
        return VoiceResponse(
            text="",
            reply="⚠️ Missing input data."
        )

    text = req.text

    # ✅ Generate response (no memory dependency)
    try:
        reply = hf_simple_response(text, "")
    except Exception:
        reply = "⚠️ Failed to generate response."

    return VoiceResponse(text=text, reply=reply)