#backend/summarization_agent.py
def handle(text):
    # simple summarization: first sentence or short paraphrase
    if len(text.split()) < 40:
        return "Paraphrase: " + text
    return "Summary: " + text.split(".")[0] + "."
