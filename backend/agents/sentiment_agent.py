#backend/sentiment_agent.py
import text2emotion as te
import emoji

def handle(message: str) -> str:
    """
    Detect user's emotion and return an empathetic AI response.
    """
    emotions = te.get_emotion(message)
    dominant_emotion = max(emotions, key=emotions.get)

    response_templates = {
        "Happy": "😊 I'm glad to hear that! Happiness is contagious — what made your day so great?",
        "Angry": "😤 It sounds like something frustrated you. Want to talk about what caused it?",
        "Surprise": "😲 That must have been unexpected! Tell me more about what surprised you.",
        "Sad": "😢 I’m really sorry you’re feeling down. Sometimes it helps to talk — I’m here for you.",
        "Fear": "😟 That sounds worrying. You don’t have to face it alone — want me to help you find a way to feel safer?",
    }

    if all(value == 0 for value in emotions.values()):
        return "🤔 I’m not sure how you’re feeling, but I’m here if you’d like to talk."

    return response_templates.get(dominant_emotion, "I’m here to listen if you want to share more.")