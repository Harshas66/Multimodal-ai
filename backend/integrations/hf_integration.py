# backend/integrations/hf_integrations.py

from huggingface_hub import InferenceClient
import os
from dotenv import load_dotenv
from typing import Generator

load_dotenv()

# ==============================
# 🔧 LOAD CONFIG FROM .ENV
# ==============================

HF_TOKEN = os.getenv("HF_TOKEN")
HF_MODEL = os.getenv("HF_MODEL", "meta-llama/Llama-3.3-70B-Instruct")
HF_FALLBACK_MODEL = os.getenv("HF_FALLBACK_MODEL", "meta-llama/Llama-3.1-8B-Instruct")

HF_MAX_TOKENS = int(os.getenv("HF_MAX_TOKENS", 1800))
HF_TEMPERATURE = float(os.getenv("HF_TEMPERATURE", 0.7))
HF_TOP_P = float(os.getenv("HF_TOP_P", 0.9))


# ==============================
# 🧠 CREATE CLIENT (NO MODEL HERE)
# ==============================

def get_hf_client():
    return InferenceClient(token=HF_TOKEN)


# ==============================
# 🧠 STREAMING LLM RESPONSE
# ==============================

def hf_llama_stream(prompt: str, context: str = "") -> Generator[str, None, None]:

    if not HF_TOKEN:
        yield "⚠️ Missing HF_TOKEN. Please check your .env file."
        return

    messages = [
        {
            "role": "system",
            "content": (
                "You are a highly intelligent multimodal AI assistant. "
                "Provide clear, structured, and complete responses."
            )
        },
        {
            "role": "user",
            "content": f"{context}\n{prompt}"
        }
    ]

    try:
        client = get_hf_client()

        stream = client.chat_completion(
            model=HF_MODEL,   # MODEL ONLY HERE
            messages=messages,
            max_tokens=HF_MAX_TOKENS,
            temperature=HF_TEMPERATURE,
            top_p=HF_TOP_P,
            stream=True
        )

        for chunk in stream:
            if chunk.choices:
                delta = chunk.choices[0].delta
                if delta and "content" in delta and delta["content"]:
                    yield delta["content"]

    except Exception:
        # Fallback
        try:
            yield "\n⚠️ Primary model failed. Switching to fallback model...\n"

            client = get_hf_client()

            response = client.chat_completion(
                model=HF_FALLBACK_MODEL,
                messages=messages,
                max_tokens=1200,
                temperature=0.7,
                top_p=0.9,
            )

            yield response.choices[0].message["content"]

        except Exception as fallback_error:
            yield f"\n⚠️ Hugging Face Error: {str(fallback_error)}"


# ==============================
# 🧩 SIMPLE NON-STREAM RESPONSE
# ==============================

def hf_simple_response(prompt: str, context: str = "") -> str:

    if not HF_TOKEN:
        return "⚠️ Missing HF_TOKEN. Please check your .env file."

    messages = [
        {
            "role": "system",
            "content": (
                "You are a highly intelligent multimodal AI assistant. "
                "Provide complete and structured responses."
            )
        },
        {
            "role": "user",
            "content": f"{context}\n{prompt}"
        }
    ]

    try:
        client = get_hf_client()

        response = client.chat_completion(
            model=HF_MODEL,   # MODEL ONLY HERE
            messages=messages,
            max_tokens=HF_MAX_TOKENS,
            temperature=HF_TEMPERATURE,
            top_p=HF_TOP_P,
        )

        return response.choices[0].message["content"]

    except Exception:
        try:
            client = get_hf_client()

            response = client.chat_completion(
                model=HF_FALLBACK_MODEL,
                messages=messages,
                max_tokens=1200,
                temperature=0.7,
                top_p=0.9,
            )

            return response.choices[0].message["content"]

        except Exception as fallback_error:
            return f"⚠️ Hugging Face Inference Error: {str(fallback_error)}"