# backend/routes/vision.py

import io
import os
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import Optional
from PIL import Image
import torch
from transformers import BlipProcessor, BlipForConditionalGeneration
from integrations.hf_integration import hf_simple_response  # ✅ import once

router = APIRouter()

# ==================== MODEL LOADING ====================

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
BLIP_MODEL_ID = os.getenv("BLIP_MODEL", "Salesforce/blip-image-captioning-large")

try:
    processor = BlipProcessor.from_pretrained(BLIP_MODEL_ID)
    model = BlipForConditionalGeneration.from_pretrained(BLIP_MODEL_ID)
    model.to(DEVICE)
    model.eval()
    print(f"✅ BLIP model loaded on {DEVICE}: {BLIP_MODEL_ID}")
except Exception as e:
    processor = None
    model = None
    print("⚠️ Failed to load BLIP model at import time:", e)


# ==================== RESPONSE SCHEMA ====================

class VisionResponse(BaseModel):
    reply: str
    details: Optional[dict] = None


# ==================== MAIN ENDPOINT ====================

@router.post("/analyze", response_model=VisionResponse)
async def analyze_image(file: UploadFile = File(...)):
    """
    Analyze an uploaded image and generate a detailed human-like explanation.
    Uses BLIP for captioning and LLaMA for reasoning.
    """

    # Check model
    if processor is None or model is None:
        raise HTTPException(status_code=503, detail="Vision model not loaded on server.")

    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file is not an image.")

    try:
        # Read and process image
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")

        inputs = processor(images=image, return_tensors="pt").to(DEVICE)
        with torch.no_grad():
            output_ids = model.generate(**inputs, max_length=80, num_beams=4, early_stopping=True)

        # Step 1️⃣: BLIP caption
        caption = processor.decode(output_ids[0], skip_special_tokens=True).strip()

        # Step 2️⃣: Ask LLaMA to explain in detail
        context_prompt = (
            f"The BLIP vision model described this image as: '{caption}'.\n"
            f"Now provide a clear and detailed explanation of what this image might represent. "
            f"Explain like a human — describe the setting, objects, and possible context or purpose. "
            f"Avoid repeating the same sentence; make it natural and insightful."
        )

        try:
            refined_explanation = hf_simple_response(context_prompt)
        except Exception as e:
            refined_explanation = f"(⚠️ Refinement failed: {e})"

        # Step 3️⃣: Details metadata
        details = {
            "caption": caption,
            "width": image.width,
            "height": image.height,
            "content_type": file.content_type,
            "model": BLIP_MODEL_ID,
            "device": DEVICE,
        }

        return VisionResponse(reply=refined_explanation, details=details)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image analysis failed: {str(e)}")