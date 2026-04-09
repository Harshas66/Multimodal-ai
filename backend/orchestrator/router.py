from typing import Optional
import re

from integrations.hf_integration import hf_simple_response
from integrations.openai_integration import openai_response
from integrations.google_integration import google_gemini_response
from integrations.web_search import tavily_search


def is_image_request(prompt: str):

    p = prompt.lower()

    explicit_keywords = [
        "generate image",
        "create image",
        "make image",
        "image of",
        "photo of",
        "picture of",
        "ai image",
        "image please",
        "draw",
        "illustration",
        "logo",
        "poster",
        "banner",
        "wallpaper",
        "thumbnail",
        "icon",
        "edit image",
        "modify image",
    ]

    if any(k in p for k in explicit_keywords):
        return True

    # Catch natural requests like "generate a sea shore sunset scene"
    visual_verbs = r"(generate|create|make|design|draw|illustrate|paint|render)"
    visual_targets = r"(image|picture|photo|art|artwork|logo|poster|banner|wallpaper|thumbnail|icon|portrait|scene|illustration)"
    if re.search(rf"\b{visual_verbs}\b.*\b{visual_targets}\b", p):
        return True

    # Avoid routing code-generation prompts to image API.
    code_words = ("code", "python", "javascript", "java", "cpp", "c++", "sql", "function", "script")
    if re.search(rf"^\s*{visual_verbs}\b", p) and not any(w in p for w in code_words):
        return True

    return False


def needs_web_search(prompt: str):

    p = prompt.lower()

    keywords = [
        "latest",
        "today",
        "current",
        "news",
        "price",
        "weather",
        "score",
        "stock",
        "update"
    ]

    return any(k in p for k in keywords)


def smart_route(prompt: str, user_message: Optional[str] = None):
    route_text = user_message or prompt

    # 1️⃣ IMAGE GENERATION → OPENAI
    if is_image_request(route_text):

        try:
            # Use the raw user prompt for image generation; memory context can degrade image quality.
            return openai_response(route_text)

        except Exception as e:
            print("OpenAI image error:", e)
            return f"⚠️ Image generation failed: {e}"


    # 2️⃣ WEB SEARCH
    if needs_web_search(route_text):

        try:

            results = tavily_search(prompt)

            if results:

                context = ""

                for r in results:
                    context += f"\nTitle: {r['title']}\nContent: {r['content']}\n"

                web_prompt = f"""
Use the following web search results to answer the question.

Web results:
{context}

User question:
{prompt}
"""

                return hf_simple_response(web_prompt)

        except Exception as e:
            print("Web search error:", e)


    # 3️⃣ PRIMARY MODEL → LLAMA
    try:

        return hf_simple_response(prompt)

    except Exception as e:

        print("HF error:", e)


    # 4️⃣ FALLBACK → GEMINI
    try:

        return google_gemini_response(prompt)

    except Exception as e:

        print("Gemini fallback error:", e)


    return "⚠️ AI services temporarily unavailable."
