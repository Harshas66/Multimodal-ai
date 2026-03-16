# backend/integrations/web_search.py
import os
from tavily import TavilyClient


def tavily_search(query: str):
    try:
        api_key = os.getenv("TAVILY_API_KEY")
        if not api_key:
            return []

        safe_query = " ".join((query or "").split())[:390]

        client = TavilyClient(api_key=api_key)

        response = client.search(
            query=safe_query,
            search_depth="advanced",
            include_images=True
        )

        results = []
        for item in response.get("results", [])[:5]:
            results.append({
                "title": item.get("title"),
                "url": item.get("url"),
                "content": item.get("content"),
                "image": item.get("image")
            })

        return results

    except Exception as e:
        print("Tavily error:", e)
        return []