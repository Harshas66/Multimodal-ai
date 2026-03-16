# backend/orchestrator/router.py
from backend.integrations.hf_integration import hf_simple_response
from backend.integrations.openai_integration import openai_response
from backend.integrations.google_integration import google_gemini_response
from backend.integrations.web_search import tavily_search


def _extract_user_query(prompt: str) -> str:
    marker = "Current user input:"
    if marker in prompt:
        return prompt.split(marker, 1)[1].strip()
    return prompt.strip()


def _compress_search_query(query: str, max_chars: int = 350, max_words: int = 24) -> str:
    text = " ".join((query or "").strip().split())
    if not text:
        return ""

    stopwords = {
        "the", "a", "an", "and", "or", "to", "for", "of", "in", "on", "with", "is",
        "are", "was", "were", "be", "been", "it", "this", "that", "these", "those",
        "i", "you", "we", "they", "he", "she", "please", "can", "could", "would",
        "should", "explain", "tell", "me", "about", "detail", "details", "what", "how"
    }

    tokens = []
    for token in text.lower().split():
        clean = "".join(ch for ch in token if ch.isalnum() or ch in {"-", "."})
        if clean and clean not in stopwords and len(clean) > 1:
            tokens.append(clean)

    if not tokens:
        tokens = text.lower().split()

    compact = " ".join(tokens[:max_words]).strip()
    if len(compact) > max_chars:
        compact = compact[:max_chars].rsplit(" ", 1)[0].strip() or compact[:max_chars]

    return compact or text[:max_chars]


def needs_web_search(prompt: str) -> bool:
    prompt_lower = prompt.lower()

    keywords = [
        "price", "cost", "how much", "mrp",
        "buy", "purchase", "order",
        "available", "availability",
        "discount", "offer", "deal",
        "cheapest", "best price",
        "review", "reviews", "rating", "ratings",
        "feedback", "customer experience",
        "is it good", "worth buying",
        "near me", "nearby",
        "location", "address",
        "where is", "how to reach",
        "map", "directions",
        "hotel", "restaurant", "resort",
        "best hotel", "best restaurant",
        "places to visit",
        "tourist spots",
        "latest", "news", "current",
        "today", "recent",
        "update", "announcement",
        "headline",
        "top", "top 10", "compare",
        "comparison", "vs",
        "which is better",
        "alternatives",
        "specs", "specifications",
        "features", "launch date",
        "release date",
        "founder", "ceo",
        "market cap", "share price",
        "stock price",
        "weather", "temperature",
        "forecast",
        "match result", "score",
        "live score", "winner",
        "box office", "collection",
        "cast", "release",
        "trailer",
    ]

    return any(keyword in prompt_lower for keyword in keywords)


def _llm_fallback(prompt: str) -> str:
    try:
        return google_gemini_response(prompt)
    except Exception:
        try:
            return openai_response(prompt)
        except Exception:
            return hf_simple_response(prompt)


def smart_route(prompt: str):
    user_query = _extract_user_query(prompt)

    # -------- Web Search --------
    try:
        if needs_web_search(user_query):
            search_query = _compress_search_query(user_query)
            search_results = tavily_search(search_query)

            if search_results:
                enhanced_prompt = f"""
Use these web search results if helpful.

Web Results:
{search_results}

User Question:
{user_query}
"""
                prompt = enhanced_prompt
    except Exception as e:
        print("Web search failed:", e)

    # -------- Model Routing --------
    try:
        return google_gemini_response(prompt)
    except Exception as e:
        print("Gemini failed:", e)

    try:
        return openai_response(prompt)
    except Exception as e:
        print("OpenAI failed:", e)

    try:
        return hf_simple_response(prompt)
    except Exception as e:
        print("HF failed:", e)

    return "⚠️ AI services are temporarily unavailable."