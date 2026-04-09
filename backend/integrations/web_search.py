# backend/integrations/web_search.py
import os

tavily = None

try:
    from tavily import TavilyClient

    api_key = os.getenv("TAVILY_API_KEY")

    if api_key:
        tavily = TavilyClient(api_key=api_key)
        print("✅ Tavily initialized")
    else:
        print("⚠️ No Tavily API key found")

except Exception as e:
    print("❌ Tavily init error:", e)
    tavily = None


def tavily_search(query: str):
    if not tavily:
        return "⚠️ Web search not available"

    try:
        result = tavily.search(query)
        return result
    except Exception as e:
        print("Tavily search error:", e)
        return "⚠️ Search failed"