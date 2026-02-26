# backend/routes/chat.py
from fastapi import APIRouter
from pydantic import BaseModel
from memory.memory_manager import MemoryManager
from backend.integrations.hf_integration import hf_simple_response

router = APIRouter()
memory = MemoryManager()

class ChatRequest(BaseModel):
    user_id: str
    chat_id: str
    message: str

@router.post("/ask")
def ask(req: ChatRequest):
    user = req.user_id
    chat = req.chat_id
    text = req.message

    # 1️⃣ Privacy
    if memory.handle_privacy_commands(user, text):
        return {"reply": "✅ I've forgotten your personal data as requested."}

    # 2️⃣ Profile
    memory.extract_profile_facts(user, text)
    profile_reply = memory.answer_from_profile(user, text)
    if profile_reply:
        memory.add_turn(user, chat, text, profile_reply)
        return {"reply": profile_reply}

    # 3️⃣ Study tracking
    memory.update_study_state(user, chat, text)

    # 4️⃣ Context
    context = memory.build_context(user, chat, text)

    # 5️⃣ LLM
    reply = hf_simple_response(text, context)

    # 6️⃣ Save
    memory.add_turn(user, chat, text, reply)

    return {"reply": reply}
