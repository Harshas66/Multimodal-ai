# # integrations/google_integration.py
# import os
# import google.generativeai as genai

# def google_gemini_response(prompt):
#     key = os.getenv("GOOGLE_API_KEY")
#     if not key:
#         raise RuntimeError("Google API key missing in .env file")

#     # ✅ Force SDK to use the v1 endpoint
#     genai.configure(
#         api_key=key,
#         client_options={"api_endpoint": "https://generativelanguage.googleapis.com/v1"}
#     )

#     try:
#         # ✅ Correct model name for free API
#         model = genai.GenerativeModel("models/gemini-1.5-flash")
#         response = model.generate_content(prompt)
#         return f"[Gemini 1.5 Flash]: {response.text.strip()}"
#     except Exception as e:
#         return f"⚠️ Google Gemini Error: {e}"

# backend/integrations/google_integration.py

def google_gemini_response(prompt: str) -> str:
    return "⚠️ Google Gemini is disabled (fallback active)."