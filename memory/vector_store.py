# memory/vector_store.py
import chromadb
from chromadb.config import Settings
from memory.embeddings import HFEmbeddingFunction

class VectorStore:
    def __init__(self):
        self.client = chromadb.Client(
            Settings(
                persist_directory="./vector_db",
                anonymized_telemetry=False
            )
        )

        self.embedding_function = HFEmbeddingFunction()

        self.collection = self.client.get_or_create_collection(
            name="memory",
            embedding_function=self.embedding_function
        )

    def add(self, user_id, chat_id, text):
        uid = f"{user_id}_{chat_id}_{hash(text)}"
        self.collection.add(
            ids=[uid],
            documents=[text],
            metadatas=[{
                "user_id": user_id,
                "chat_id": chat_id
            }]
        )

    def query(self, user_id, query, k=5):
        results = self.collection.query(
            query_texts=[query],
            n_results=k,
            where={"user_id": user_id}
        )
        return results.get("documents", [[]])[0]

    def delete_user(self, user_id):
        self.collection.delete(where={"user_id": user_id})
