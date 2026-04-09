# memory/memory_manager.py
import re
from collections import defaultdict
from memory.vector_store import VectorStore

class MemoryManager:
    def __init__(self):
        self.vector = VectorStore()
        self.profile = defaultdict(dict)
        self.study_state = defaultdict(dict)

    # ================= PRIVACY =================
    def handle_privacy_commands(self, user_id, text):
        text = text.lower()

        if any(k in text for k in [
            "forget my name",
            "delete my name",
            "don't remember my name",
            "forget me"
        ]):
            self.profile[user_id].pop("name", None)
            self.vector.delete_user(user_id)
            return True
        return False

    # ================= PROFILE =================
    def extract_profile_facts(self, user_id, text):
        match = re.search(r"my name is (\w+)", text.lower())
        if match:
            self.profile[user_id]["name"] = match.group(1).capitalize()

    def answer_from_profile(self, user_id, text):
        if "what is my name" in text.lower():
            name = self.profile[user_id].get("name")
            if name:
                return f"Your name is {name}."
            return "I don't know your name."

        return None

    # ================= STUDY =================
    def update_study_state(self, user_id, chat_id, text):
        keywords = ["learn", "study", "teach me"]
        if any(k in text.lower() for k in keywords):
            self.study_state[user_id][chat_id] = text

    # ================= CONTEXT =================
    def build_context(self, user_id, chat_id, query):
        memories = self.vector.query(user_id, query)
        profile = self.profile[user_id]

        context = ""

        if profile.get("name"):
            context += f"User name: {profile['name']}\n"

        if memories:
            context += "Relevant past context:\n"
            for m in memories:
                context += f"- {m}\n"

        return context

    # ================= SAVE =================
    def add_turn(self, user_id, chat_id, user_text, bot_reply):
        combined = f"User: {user_text}\nAI: {bot_reply}"
        self.vector.add(user_id, chat_id, combined)
