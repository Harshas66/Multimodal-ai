import sqlite3
import uuid

from datetime import datetime

from memory.models.memory_models import Memory


class PersistentStore:

    def __init__(
        self,
        db_path: str = "memory.db"
    ):

        self.db_path = db_path

        self.create_tables()

    def create_tables(self):

        connection = sqlite3.connect(self.db_path)

        cursor = connection.cursor()

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS memories (

                id TEXT PRIMARY KEY,

                user_id TEXT NOT NULL,

                content TEXT NOT NULL,

                memory_type TEXT NOT NULL,

                consent_status TEXT NOT NULL,

                sensitivity_level TEXT NOT NULL,

                importance_score REAL,

                created_at TEXT,

                updated_at TEXT,

                expires_at TEXT,

                embedding_id TEXT,

                session_id TEXT,

                chat_id TEXT
            )
            """
        )

        connection.commit()

        connection.close()

    def store_memory(
        self,
        memory: Memory
    ):

        connection = sqlite3.connect(self.db_path)

        cursor = connection.cursor()

        cursor.execute(
            """
            INSERT INTO memories VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
            """,
            (
                memory.id,
                memory.user_id,
                memory.content,
                memory.memory_type.value,
                memory.consent_status.value,
                memory.sensitivity_level.value,
                memory.importance_score,
                str(memory.created_at),
                str(memory.updated_at),
                str(memory.expires_at),
                memory.embedding_id,
                memory.session_id,
                memory.chat_id
            )
        )

        connection.commit()

        connection.close()

    def get_user_memories(
        self,
        user_id: str
    ):

        connection = sqlite3.connect(self.db_path)

        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT * FROM memories
            WHERE user_id = ?
            """,
            (user_id,)
        )

        memories = cursor.fetchall()

        connection.close()

        return memories

    def delete_memory(
        self,
        memory_id: str
    ):

        connection = sqlite3.connect(self.db_path)

        cursor = connection.cursor()

        cursor.execute(
            """
            DELETE FROM memories
            WHERE id = ?
            """,
            (memory_id,)
        )

        connection.commit()

        connection.close()

    def clear_user_memories(
        self,
        user_id: str
    ):

        connection = sqlite3.connect(self.db_path)

        cursor = connection.cursor()

        cursor.execute(
            """
            DELETE FROM memories
            WHERE user_id = ?
            """,
            (user_id,)
        )

        connection.commit()

        connection.close()
