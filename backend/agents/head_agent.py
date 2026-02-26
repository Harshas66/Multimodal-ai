#backend/head_agent.py
import os
from dotenv import load_dotenv

# Load .env from project root
env_path = os.path.join(os.getcwd(), ".env")
load_dotenv(dotenv_path=env_path)
print(f"✅ .env loaded from: {env_path}")

from agents import sentiment_agent, translation_agent, summarization_agent
from integrations.hf_integration import hf_llama_stream
from integrations.google_integration import google_gemini_response
from backend.agents import sentiment_agent
class HeadAgent:
    """Main routing controller — like ChatGPT’s orchestration brain."""
    
    def __init__(self):
        self.log = []

    def get_active_model(self):
        if os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACEHUB_API_TOKEN"):
            return "🟢 Hugging Face LLaMA 3.1"

        elif os.getenv("GOOGLE_API_KEY"):
            return "⚡ Google Gemini"
        else:
            return "⚪ Local Fallback (No Cloud Model)"

    def decide_agent(self, text):
        """Decide which specialized sub-agent to route the query to."""
        t = text.lower()
        if any(k in t for k in ["summarize", "summary", "shorten"]):
            return "summarization"
        if any(k in t for k in ["translate", "translation", "meaning"]):
            return "translation"
        if any(k in text.lower() for k in ["sad", "happy", "angry", "worried", "anxious", "depressed"]):
            resp = sentiment_agent.handle(text)
            return resp, "Sentiment Agent"
        return "llm"

    def handle(self, text, language="English", memory_context=""):
        """
        Main router: decides agent and queries the right model.
        Accepts text, language, and memory_context (3 args total)
        """
        self.log.append(("user", text))
        agent_type = self.decide_agent(text)

        # Specialized agents
        if agent_type == "sentiment":
            resp = sentiment_agent.handle(text)
            return resp, "Sentiment Agent"

        elif agent_type == "translation":
            target = "te" if language.lower() == "english" else "en"
            resp = translation_agent.handle(text, target)
            return resp, "Translation Agent"

        elif agent_type == "summarization":
            resp = summarization_agent.handle(text)
            return resp, "Summarization Agent"

        # Default route — LLaMA / Gemini / Local fallback
        hf_token = os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACEHUB_API_TOKEN")

        google_key = os.getenv("GOOGLE_API_KEY")

        if hf_token:
            try:
                # Stream response from LLaMA 3.1
                full_text = ""
                for chunk in hf_llama_stream(f"{memory_context}\nUser: {text}"):
                    full_text += chunk
                return full_text, "LLaMA 3.1 (HF)"
            except Exception as e:
                print("⚠️ HF Error:", e)

        if google_key:
            try:
                resp = google_gemini_response(text)
                return resp, "Gemini"
            except Exception as e:
                print("⚠️ Gemini Error:", e)

        # Offline fallback
        return (
            "🤖 (Offline): Sorry, I’m running locally and can’t reach the cloud models right now.",
            "Local Fallback",
        )
