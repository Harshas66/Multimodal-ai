import os

def analyze_image(image_url: str) -> str:
    try:
        # 🔥 If running on Render → skip heavy model
        if os.getenv("RENDER"):
            return f"🖼️ Image received: {image_url}. Analysis ready (light mode)."

        # ✅ Local (your system) → use BLIP
        from transformers import pipeline

        global image_pipe
        if "image_pipe" not in globals():
            print("🔄 Loading BLIP model...")
            image_pipe = pipeline(
                "image-to-text",
                model="Salesforce/blip-image-captioning-base"
            )

        result = image_pipe(image_url)

        if result and len(result) > 0:
            return result[0]["generated_text"]

        return "No description generated"

    except Exception as e:
        return f"⚠️ Image analysis failed: {str(e)}"
