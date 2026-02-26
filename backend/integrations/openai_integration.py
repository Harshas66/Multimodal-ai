#backend/integrations/openai_integration.py
import os
def openai_response(prompt):
    from openai import OpenAI
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        raise RuntimeError("OpenAI key missing")
    client = OpenAI(api_key=key)
    resp = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[{"role":"system","content":"You are a helpful assistant."},
                  {"role":"user","content":prompt}],
        max_tokens=256
    )
    # new SDK response structure
    try:
        return f"[OpenAI] {resp.choices[0].message.content}"
    except Exception:
        return "[OpenAI] " + str(resp)
