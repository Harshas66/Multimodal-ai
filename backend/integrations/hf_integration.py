from huggingface_hub import InferenceClient
import os
from dotenv import load_dotenv

load_dotenv()

def hf_llama_stream(prompt: str, context: str = ""):
    """Generate chat-style responses using LLaMA 3.1 via Hugging Face."""
    hf_token = os.getenv("HF_TOKEN")
    if not hf_token:
        yield "⚠️ Missing HF_TOKEN. Please check your .env file."
        return

    try:
        client = InferenceClient("meta-llama/Llama-3.1-8B-Instruct", token=hf_token)
        messages = [
            {"role": "system", "content": "You are a helpful multimodal AI assistant."},
            {"role": "user", "content": f"{context}\n{prompt}"}
        ]

        response = client.chat_completion(
            model="meta-llama/Llama-3.1-8B-Instruct",
            messages=messages,
            max_tokens=512,
            temperature=0.7
        )

        # Stream or return final content
        yield response.choices[0].message["content"]

    except Exception as e:
        yield f"⚠️ Hugging Face Inference Error: {e}"
# ==============================
# 🧩 SIMPLE RESPONSE WRAPPER
# ==============================

def hf_simple_response(prompt: str, context: str = "") -> str:
    """
    A simple wrapper around hf_llama_stream to return a single clean text output.
    Used by FastAPI route for one-shot responses.
    """
    try:
        chunks = list(hf_llama_stream(prompt, context))
        if chunks:
            return chunks[-1]
        else:
            return "⚠️ No response generated from LLaMA."
    except Exception as e:
        return f"⚠️ Hugging Face Inference Error: {str(e)}"