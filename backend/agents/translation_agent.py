#backend/agents/translation_agent.py
# using googletrans-temp safe fork
from googletrans import Translator
translator = Translator()

def handle(text, dest='en'):
    try:
        res = translator.translate(text, dest=dest)
        return res.text
    except Exception:
        return "Translation service unavailable."
