from transformers import pipeline

image_pipe = None  # ❗ DO NOT LOAD AT STARTUP


def analyze_image(image_url: str) -> str:
    global image_pipe

    try:
        # ✅ Lazy load (only first time)
        if image_pipe is None:
            print("🔄 Loading BLIP model...")
            image_pipe = pipeline(
                "image-to-text",
                model="Salesforce/blip-image-captioning-base"
            )
            print("✅ BLIP model loaded")

        result = image_pipe(image_url)

        if result and len(result) > 0:
            return result[0]["generated_text"]

        return "No description generated"

    except Exception as e:
        return f"⚠️ Image analysis failed: {str(e)}"
