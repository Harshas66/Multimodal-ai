import os
def openai_response(prompt):
    from openai import OpenAI
    import os

    key = os.getenv("OPENAI_API_KEY")
    if not key:
        raise RuntimeError("OpenAI key missing")

    client = OpenAI(api_key=key)

    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": prompt}
        ],
        max_tokens=256
    )

    return resp.choices[0].message.content
