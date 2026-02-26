#backend/ utils/text_to_speech.py
import pyttsx3

def speak_text(text):
    """Convert text to speech."""
    try:
        engine = pyttsx3.init()
        engine.setProperty("rate", 170)
        engine.setProperty("volume", 1.0)
        engine.say(text)
        engine.runAndWait()
    except Exception as e:
        print("TTS error:", e)
