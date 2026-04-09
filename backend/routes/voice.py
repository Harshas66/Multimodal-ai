#backend/routes/voice.py
from fastapi import APIRouter, Body
from pydantic import BaseModel
import speech_recognition as sr

from memory.memory_manager import MemoryManager
from integrations.hf_integration import hf_simple_response

router = APIRouter()
memory = MemoryManager()
recognizer = sr.Recognizer()


# ✅ Request model (THIS WAS MISSING)
class VoiceRequest(BaseModel):
    user_id: str
    chat_id: str


# ✅ Response model
class VoiceResponse(BaseModel):
    text: str
    reply: str


@router.post("/speak", response_model=VoiceResponse)
async def speak(req: VoiceRequest = Body(default=None)):

    # ✅ Safety: prevent 422 forever
    if req is None or not req.user_id or not req.chat_id:
        return VoiceResponse(
            text="",
            reply="⚠️ Voice request missing user or chat information."
        )

    user_id = req.user_id
    chat_id = req.chat_id

    # ✅ Capture voice from SYSTEM MICROPHONE
    try:
        with sr.Microphone() as source:
            recognizer.adjust_for_ambient_noise(source, duration=0.5)
            audio = recognizer.listen(source, timeout=6)
    except Exception:
        return VoiceResponse(
            text="",
            reply="⚠️ Microphone not accessible."
        )

    # ✅ Speech → text
    try:
        text = recognizer.recognize_google(audio)
    except:
        return VoiceResponse(
            text="(No speech)",
            reply="⚠️ I couldn't hear you clearly."
        )

    # ✅ Memory handling
    memory.handle_privacy_commands(user_id, text)
    memory.extract_profile_facts(user_id, text)

    profile_reply = memory.answer_from_profile(user_id, text)
    if profile_reply:
        memory.add_turn(user_id, chat_id, text, profile_reply)
        return VoiceResponse(text=text, reply=profile_reply)

    # ✅ Context-aware reply
    context = memory.build_context(user_id, chat_id, text)
    reply = hf_simple_response(text, context)

    memory.add_turn(user_id, chat_id, text, reply)

    return VoiceResponse(text=text, reply=reply)
