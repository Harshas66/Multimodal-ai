#backend/integrations/google_integration.py
import os
import google.generativeai as genai


def google_gemini_response(prompt):
    key = os.getenv("GOOGLE_API_KEY")
    if not key:
        raise RuntimeError("Google API key missing in .env file")

    genai.configure(
        api_key=key,
        client_options={"api_endpoint": "https://generativelanguage.googleapis.com/v1"}
    )

    try:
        model = genai.GenerativeModel("models/gemini-1.5-flash")
        response = model.generate_content(prompt, request_options={"timeout": 20})
        text = (getattr(response, "text", "") or "").strip()
        if not text:
            raise RuntimeError("Empty response from Gemini")
        return f"[Gemini 1.5 Flash]: {text}"
    except Exception as e:
        raise RuntimeError(f"Google Gemini Error: {e}") from e
