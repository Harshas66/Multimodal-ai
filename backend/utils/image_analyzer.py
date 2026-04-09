from transformers import pipeline

# Load model once (IMPORTANT)
try:
    image_pipe = pipeline(
        "image-to-text",
        model="Salesforce/blip-image-captioning-base"
    )
    print("✅ BLIP model loaded")
except Exception as e:
    print("❌ Model load error:", e)
    image_pipe = None


def analyze_image(image_url: str) -> str:
    try:
        if not image_pipe:
            return "⚠️ Image model not available"

        result = image_pipe(image_url)

        if result and len(result) > 0:
            return result[0]["generated_text"]

        return "No description generated"

    except Exception as e:
        return f"⚠️ Image analysis failed: {str(e)}"
