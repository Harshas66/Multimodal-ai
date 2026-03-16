#backend/agents/translation_agent.py
# using googletrans-temp safe fork
from deep_translator import GoogleTranslator

def handle(text, target="en"):
    return GoogleTranslator(source="auto", target=target).translate(text)