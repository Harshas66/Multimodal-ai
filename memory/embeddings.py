# memory/embeddings.py
from sentence_transformers import SentenceTransformer
from chromadb.api.types import EmbeddingFunction

class HFEmbeddingFunction(EmbeddingFunction):
    def __init__(self):
        self.model = SentenceTransformer("all-MiniLM-L6-v2")

    def __call__(self, texts):
        # Chroma passes a LIST of texts
        return self.model.encode(texts).tolist()
