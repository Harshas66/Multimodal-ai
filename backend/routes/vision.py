# backend/routes/vision.py
# Uses HuggingFace Inference API for image captioning (no local model download)

import io
import os
import httpx
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from typing import Optional

from integrations.hf_integration import hf_simple_response

router = APIRouter()

HF_TOKEN = os.getenv("HF_TOKEN", "")
HF_VISION_MODEL = os.getenv("HF_VISION_MODEL", "Salesforce/blip-image-captioning-large")
HF_API_URL = f"https://api-inference.huggingface.co/models/{HF_VISION_MODEL}"


class VisionResponse(BaseModel):
    reply: str
    details: Optional[dict] = None


@router.post("/analyze", response_model=VisionResponse)
async def analyze_image(
    file: UploadFile = File(...),
    query: str = Form(default="")
):
    """
    Analyze an uploaded image using HuggingFace Inference API (BLIP).
    No local model download required — serverless friendly.
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file is not an image.")

    contents = await file.read()

    # ── Step 1: Caption via HF Inference API ──────────────────
    caption = ""
    if HF_TOKEN:
        try:
            headers = {"Authorization": f"Bearer {HF_TOKEN}"}
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(HF_API_URL, headers=headers, content=contents)
                if resp.status_code == 200:
                    data = resp.json()
                    if isinstance(data, list) and data:
                        caption = data[0].get("generated_text", "")
                    elif isinstance(data, dict):
                        caption = data.get("generated_text", "")
        except Exception as e:
            print(f"⚠️ HF Vision API error: {e}")

    if not caption:
        caption = "an image provided by the user"

    # ── Step 2: Enrich with LLM reasoning ─────────────────────
    user_q = query.strip() or "Describe what you see in this image."
    context_prompt = (
        f"A vision model analyzed an image and generated this caption: '{caption}'.\n"
        f"User's question about the image: {user_q}\n\n"
        f"Based on the caption, provide a helpful, detailed, human-like response to the user's question. "
        f"Be specific and insightful."
    )

    try:
        reply = hf_simple_response(context_prompt)
    except Exception as e:
        reply = f"Image caption: {caption}. (AI enrichment failed: {e})"

    return VisionResponse(
        reply=reply,
        details={
            "caption": caption,
            "model": HF_VISION_MODEL,
            "content_type": file.content_type,
        }
    )