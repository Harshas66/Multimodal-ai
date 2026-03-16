#backend/integrations/hf_integration.py
from huggingface_hub import InferenceClient
import os
from dotenv import load_dotenv

load_dotenv()

HF_TOKEN = os.getenv("HF_TOKEN")
HF_MODEL = os.getenv("HF_MODEL_PRIMARY", "meta-llama/Llama-3.1-8B-Instruct")
HF_MAX_TOKENS = int(os.getenv("HF_MAX_TOKENS", 700))  # safer limit
HF_TEMPERATURE = float(os.getenv("HF_TEMPERATURE", 0.7))
HF_TOP_P = float(os.getenv("HF_TOP_P", 0.9))


def get_client():
    if not HF_TOKEN:
        raise ValueError("HF_TOKEN is missing in environment variables.")
    return InferenceClient(token=HF_TOKEN, timeout=20)


def hf_simple_response(prompt: str, context: str = "") -> str:
    """
    Simple response using Llama 3.1 8B via Hugging Face Router.
    Optimized for low token usage.
    """

    if not HF_TOKEN:
        return "⚠️ Missing HF_TOKEN."

    messages = [
        {
            "role": "system",
            "content": "You are a clear, structured and concise AI assistant."
        },
        {
            "role": "user",
            "content": f"{context}\n{prompt}".strip()
        }
    ]

    try:
        client = get_client()

        response = client.chat_completion(
            model=HF_MODEL,
            messages=messages,
            max_tokens=HF_MAX_TOKENS,
            temperature=HF_TEMPERATURE,
            top_p=HF_TOP_P,
        )

        if response and response.choices:
            return response.choices[0].message["content"].strip()

        return "⚠️ No response generated."

    except Exception as e:
        return f"⚠️ HF Error: {str(e)}"
