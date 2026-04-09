#memory/repository.py
import hashlib
import json
import os
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    import psycopg
except Exception:  # pragma: no cover
    psycopg = None


class MemoryRepository:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.database_url = os.getenv("DATABASE_URL", "").strip()
        self._is_postgres = self.database_url.startswith("postgres://") or self.database_url.startswith("postgresql://")
        self._sqlite_path = Path(os.getenv("SQLITE_PATH", "memory/app.db"))

        if self._is_postgres and psycopg is None:
            raise RuntimeError("DATABASE_URL is postgres but psycopg is not installed")

        if not self._is_postgres:
            self._sqlite_path.parent.mkdir(parents=True, exist_ok=True)

        self._init_schema()

    def _connect(self):
        if self._is_postgres:
            return psycopg.connect(self.database_url)

        conn = sqlite3.connect(self._sqlite_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    @staticmethod
    def _to_iso(dt: Optional[str] = None) -> str:
        if dt:
            return dt
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def _hash_message(chat_id: str, role: str, content: str, timestamp: str) -> str:
        raw = f"{chat_id}|{role}|{content}|{timestamp}".encode("utf-8")
        return hashlib.sha256(raw).hexdigest()

    def _init_schema(self) -> None:
        with self._connect() as conn:
            cur = conn.cursor()
            if self._is_postgres:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS users (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        email TEXT UNIQUE NOT NULL,
                        provider TEXT NOT NULL,
                        created_at TIMESTAMPTZ NOT NULL
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS chats (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        session_id TEXT NOT NULL,
                        title TEXT NOT NULL,
                        created_at TIMESTAMPTZ NOT NULL
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS messages (
                        id TEXT PRIMARY KEY,
                        chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
                        role TEXT NOT NULL,
                        content TEXT NOT NULL,
                        source TEXT NOT NULL,
                        timestamp TIMESTAMPTZ NOT NULL,
                        embedding TEXT,
                        message_hash TEXT UNIQUE NOT NULL
                    )
                    """
                )
                cur.execute("CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_messages_time ON messages(timestamp)")
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS memory (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        key TEXT NOT NULL,
                        value TEXT NOT NULL,
                        created_at TIMESTAMPTZ NOT NULL,
                        updated_at TIMESTAMPTZ NOT NULL,
                        UNIQUE (user_id, key)
                    )
                    """
                )
                cur.execute("CREATE INDEX IF NOT EXISTS idx_memory_user_id ON memory(user_id)")
            else:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS users (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        email TEXT UNIQUE NOT NULL,
                        provider TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS chats (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        session_id TEXT NOT NULL,
                        title TEXT NOT NULL,
                        created_at TEXT NOT NULL,
                        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS messages (
                        id TEXT PRIMARY KEY,
                        chat_id TEXT NOT NULL,
                        role TEXT NOT NULL,
                        content TEXT NOT NULL,
                        source TEXT NOT NULL,
                        timestamp TEXT NOT NULL,
                        embedding TEXT,
                        message_hash TEXT UNIQUE NOT NULL,
                        FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
                    )
                    """
                )
                cur.execute("CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_messages_time ON messages(timestamp)")
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS memory (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        key TEXT NOT NULL,
                        value TEXT NOT NULL,
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL,
                        UNIQUE (user_id, key),
                        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                    )
                    """
                )
                cur.execute("CREATE INDEX IF NOT EXISTS idx_memory_user_id ON memory(user_id)")

            conn.commit()

    def upsert_user(self, *, user_id: str, name: str, email: str, provider: str = "google") -> Dict[str, Any]:
        created_at = self._to_iso()
        with self._lock, self._connect() as conn:
            cur = conn.cursor()
            if self._is_postgres:
                cur.execute(
                    """
                    INSERT INTO users (id, name, email, provider, created_at)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (id)
                    DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, provider = EXCLUDED.provider
                    """,
                    (user_id, name, email, provider, created_at),
                )
                cur.execute("SELECT id, name, email, provider, created_at FROM users WHERE id = %s", (user_id,))
                row = cur.fetchone()
            else:
                cur.execute(
                    """
                    INSERT INTO users (id, name, email, provider, created_at)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET name = excluded.name, email = excluded.email, provider = excluded.provider
                    """,
                    (user_id, name, email, provider, created_at),
                )
                cur.execute("SELECT id, name, email, provider, created_at FROM users WHERE id = ?", (user_id,))
                row = cur.fetchone()
            conn.commit()
        return self._row_to_dict(row)

    def get_user(self, *, user_id: str) -> Dict[str, Any]:
        with self._connect() as conn:
            cur = conn.cursor()
            if self._is_postgres:
                cur.execute("SELECT id, name, email, provider, created_at FROM users WHERE id = %s", (user_id,))
            else:
                cur.execute("SELECT id, name, email, provider, created_at FROM users WHERE id = ?", (user_id,))
            row = cur.fetchone()
        return self._row_to_dict(row)

    def ensure_user(self, *, user_id: str, email: str = "", name: str = "", provider: str = "password") -> Dict[str, Any]:
        existing = self.get_user(user_id=user_id)
        if existing:
            needs_update = False
            next_name = existing.get("name") or name or (email.split("@")[0] if email else "User")
            next_email = existing.get("email") or email
            next_provider = existing.get("provider") or provider

            if name and name != existing.get("name"):
                next_name = name
                needs_update = True
            if email and email != existing.get("email"):
                next_email = email
                needs_update = True
            if provider and provider != existing.get("provider"):
                next_provider = provider
                needs_update = True

            if needs_update:
                return self.upsert_user(user_id=user_id, name=next_name, email=next_email, provider=next_provider)
            return existing

        fallback_email = email or f"{user_id}@local.invalid"
        fallback_name = name or (fallback_email.split("@")[0] if "@" in fallback_email else "User")
        return self.upsert_user(user_id=user_id, name=fallback_name, email=fallback_email, provider=provider)

    def create_chat_if_missing(self, *, chat_id: str, user_id: str, session_id: str, title: str) -> None:
        created_at = self._to_iso()
        safe_title = (title or "New Chat").strip()[:120] or "New Chat"
        with self._lock, self._connect() as conn:
            cur = conn.cursor()
            if self._is_postgres:
                cur.execute(
                    """
                    INSERT INTO chats (id, user_id, session_id, title, created_at)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO NOTHING
                    """,
                    (chat_id, user_id, session_id, safe_title, created_at),
                )
            else:
                cur.execute(
                    """
                    INSERT OR IGNORE INTO chats (id, user_id, session_id, title, created_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (chat_id, user_id, session_id, safe_title, created_at),
                )
            conn.commit()

    def rename_chat(self, *, chat_id: str, user_id: str, title: str) -> None:
        safe_title = (title or "New Chat").strip()[:120] or "New Chat"
        with self._lock, self._connect() as conn:
            cur = conn.cursor()
            if self._is_postgres:
                cur.execute("UPDATE chats SET title = %s WHERE id = %s AND user_id = %s", (safe_title, chat_id, user_id))
            else:
                cur.execute("UPDATE chats SET title = ? WHERE id = ? AND user_id = ?", (safe_title, chat_id, user_id))
            conn.commit()

    def delete_chat(self, *, chat_id: str, user_id: str) -> None:
        with self._lock, self._connect() as conn:
            cur = conn.cursor()
            if self._is_postgres:
                cur.execute("DELETE FROM chats WHERE id = %s AND user_id = %s", (chat_id, user_id))
            else:
                cur.execute("DELETE FROM chats WHERE id = ? AND user_id = ?", (chat_id, user_id))
            conn.commit()

    def save_message(
        self,
        *,
        chat_id: str,
        role: str,
        content: str,
        source: str,
        timestamp: Optional[str] = None,
        embedding: Optional[List[float]] = None,
        message_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        msg_id = message_id or str(uuid.uuid4())
        ts = self._to_iso(timestamp)
        message_hash = self._hash_message(chat_id, role, content, ts)
        embedding_text = json.dumps(embedding or [])

        with self._lock, self._connect() as conn:
            cur = conn.cursor()
            if self._is_postgres:
                cur.execute(
                    """
                    INSERT INTO messages (id, chat_id, role, content, source, timestamp, embedding, message_hash)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (message_hash) DO NOTHING
                    """,
                    (msg_id, chat_id, role, content, source, ts, embedding_text, message_hash),
                )
                cur.execute("SELECT id, chat_id, role, content, source, timestamp, embedding FROM messages WHERE message_hash = %s", (message_hash,))
            else:
                cur.execute(
                    """
                    INSERT OR IGNORE INTO messages (id, chat_id, role, content, source, timestamp, embedding, message_hash)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (msg_id, chat_id, role, content, source, ts, embedding_text, message_hash),
                )
                cur.execute("SELECT id, chat_id, role, content, source, timestamp, embedding FROM messages WHERE message_hash = ?", (message_hash,))
            row = cur.fetchone()
            conn.commit()

        return self._row_to_dict(row)

    def list_chats(self, *, user_id: str, search: str = "") -> List[Dict[str, Any]]:
        q = f"%{search.lower()}%"
        with self._connect() as conn:
            cur = conn.cursor()
            if self._is_postgres:
                if search:
                    cur.execute(
                        """
                        SELECT c.id, c.user_id, c.session_id, c.title, c.created_at, MAX(m.timestamp) as last_message_at
                        FROM chats c
                        LEFT JOIN messages m ON m.chat_id = c.id
                        WHERE c.user_id = %s AND LOWER(c.title) LIKE %s
                        GROUP BY c.id
                        ORDER BY COALESCE(MAX(m.timestamp), c.created_at) DESC
                        """,
                        (user_id, q),
                    )
                else:
                    cur.execute(
                        """
                        SELECT c.id, c.user_id, c.session_id, c.title, c.created_at, MAX(m.timestamp) as last_message_at
                        FROM chats c
                        LEFT JOIN messages m ON m.chat_id = c.id
                        WHERE c.user_id = %s
                        GROUP BY c.id
                        ORDER BY COALESCE(MAX(m.timestamp), c.created_at) DESC
                        """,
                        (user_id,),
                    )
            else:
                if search:
                    cur.execute(
                        """
                        SELECT c.id, c.user_id, c.session_id, c.title, c.created_at, MAX(m.timestamp) as last_message_at
                        FROM chats c
                        LEFT JOIN messages m ON m.chat_id = c.id
                        WHERE c.user_id = ? AND LOWER(c.title) LIKE ?
                        GROUP BY c.id
                        ORDER BY COALESCE(MAX(m.timestamp), c.created_at) DESC
                        """,
                        (user_id, q),
                    )
                else:
                    cur.execute(
                        """
                        SELECT c.id, c.user_id, c.session_id, c.title, c.created_at, MAX(m.timestamp) as last_message_at
                        FROM chats c
                        LEFT JOIN messages m ON m.chat_id = c.id
                        WHERE c.user_id = ?
                        GROUP BY c.id
                        ORDER BY COALESCE(MAX(m.timestamp), c.created_at) DESC
                        """,
                        (user_id,),
                    )
            rows = cur.fetchall()
        return [self._row_to_dict(row) for row in rows]

    def list_messages(self, *, chat_id: str) -> List[Dict[str, Any]]:
        with self._connect() as conn:
            cur = conn.cursor()
            if self._is_postgres:
                cur.execute(
                    """
                    SELECT id, chat_id, role, content, source, timestamp, embedding
                    FROM messages
                    WHERE chat_id = %s
                    ORDER BY timestamp ASC
                    """,
                    (chat_id,),
                )
            else:
                cur.execute(
                    """
                    SELECT id, chat_id, role, content, source, timestamp, embedding
                    FROM messages
                    WHERE chat_id = ?
                    ORDER BY timestamp ASC
                    """,
                    (chat_id,),
                )
            rows = cur.fetchall()
        return [self._row_to_dict(row) for row in rows]

    def recent_user_context(self, *, user_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        with self._connect() as conn:
            cur = conn.cursor()
            if self._is_postgres:
                cur.execute(
                    """
                    SELECT m.role, m.content, m.timestamp, c.title
                    FROM messages m
                    JOIN chats c ON c.id = m.chat_id
                    WHERE c.user_id = %s
                    ORDER BY m.timestamp DESC
                    LIMIT %s
                    """,
                    (user_id, limit),
                )
            else:
                cur.execute(
                    """
                    SELECT m.role, m.content, m.timestamp, c.title
                    FROM messages m
                    JOIN chats c ON c.id = m.chat_id
                    WHERE c.user_id = ?
                    ORDER BY m.timestamp DESC
                    LIMIT ?
                    """,
                    (user_id, limit),
                )
            rows = cur.fetchall()

        result = [self._row_to_dict(row) for row in rows]
        result.reverse()
        return result

    def upsert_memory(self, *, user_id: str, key: str, value: str) -> Dict[str, Any]:
        memory_id = str(uuid.uuid4())
        created_at = self._to_iso()
        updated_at = created_at
        normalized_key = (key or "").strip().lower()
        normalized_value = (value or "").strip()
        if not normalized_key or not normalized_value:
            return {}

        with self._lock, self._connect() as conn:
            cur = conn.cursor()
            if self._is_postgres:
                cur.execute(
                    """
                    INSERT INTO memory (id, user_id, key, value, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (user_id, key)
                    DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
                    """,
                    (memory_id, user_id, normalized_key, normalized_value, created_at, updated_at),
                )
                cur.execute(
                    "SELECT id, user_id, key, value, created_at, updated_at FROM memory WHERE user_id = %s AND key = %s",
                    (user_id, normalized_key),
                )
            else:
                cur.execute(
                    """
                    INSERT INTO memory (id, user_id, key, value, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
                    """,
                    (memory_id, user_id, normalized_key, normalized_value, created_at, updated_at),
                )
                cur.execute(
                    "SELECT id, user_id, key, value, created_at, updated_at FROM memory WHERE user_id = ? AND key = ?",
                    (user_id, normalized_key),
                )
            row = cur.fetchone()
            conn.commit()
        return self._row_to_dict(row)

    def list_memory(self, *, user_id: str) -> List[Dict[str, Any]]:
        with self._connect() as conn:
            cur = conn.cursor()
            if self._is_postgres:
                cur.execute(
                    """
                    SELECT id, user_id, key, value, created_at, updated_at
                    FROM memory
                    WHERE user_id = %s
                    ORDER BY updated_at DESC, key ASC
                    """,
                    (user_id,),
                )
            else:
                cur.execute(
                    """
                    SELECT id, user_id, key, value, created_at, updated_at
                    FROM memory
                    WHERE user_id = ?
                    ORDER BY updated_at DESC, key ASC
                    """,
                    (user_id,),
                )
            rows = cur.fetchall()
        return [self._row_to_dict(row) for row in rows]

    def memory_context(self, *, user_id: str) -> List[str]:
        facts = self.list_memory(user_id=user_id)
        return [f"{item['key'].replace('_', ' ').title()}: {item['value']}" for item in facts if item.get("key") and item.get("value")]

    def export_user_data(self, *, user_id: str) -> Dict[str, Any]:
        chats = self.list_chats(user_id=user_id)
        hydrated = []
        for chat in chats:
            messages = self.list_messages(chat_id=chat["id"])
            hydrated.append({**chat, "messages": messages})
        return {"chats": hydrated, "memory": self.list_memory(user_id=user_id)}

    def clear_user_history(self, *, user_id: str) -> None:
        with self._lock, self._connect() as conn:
            cur = conn.cursor()
            if self._is_postgres:
                cur.execute("DELETE FROM chats WHERE user_id = %s", (user_id,))
            else:
                cur.execute("DELETE FROM chats WHERE user_id = ?", (user_id,))
            conn.commit()

    def clear_user_data(self, *, user_id: str) -> None:
        with self._lock, self._connect() as conn:
            cur = conn.cursor()
            if self._is_postgres:
                cur.execute("DELETE FROM memory WHERE user_id = %s", (user_id,))
                cur.execute("DELETE FROM chats WHERE user_id = %s", (user_id,))
            else:
                cur.execute("DELETE FROM memory WHERE user_id = ?", (user_id,))
                cur.execute("DELETE FROM chats WHERE user_id = ?", (user_id,))
            conn.commit()

    def delete_user(self, *, user_id: str) -> None:
        with self._lock, self._connect() as conn:
            cur = conn.cursor()
            if self._is_postgres:
                cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
            else:
                cur.execute("DELETE FROM users WHERE id = ?", (user_id,))
            conn.commit()

    def sync_payload(self, *, user_id: str, chats: List[Dict[str, Any]], source: str) -> Dict[str, Any]:
        for chat in chats:
            chat_id = chat.get("id") or str(uuid.uuid4())
            self.create_chat_if_missing(
                chat_id=chat_id,
                user_id=user_id,
                session_id=chat.get("session_id") or chat_id,
                title=chat.get("title") or "New Chat",
            )
            for msg in chat.get("messages", []):
                self.save_message(
                    message_id=msg.get("id"),
                    chat_id=chat_id,
                    role=(msg.get("role") or "assistant").lower(),
                    content=msg.get("content") or msg.get("text") or "",
                    source=msg.get("source") or source,
                    timestamp=msg.get("timestamp") or msg.get("createdAt"),
                    embedding=msg.get("embedding") or [],
                )

        for fact in self._extract_memory_from_chats(chats):
            self.upsert_memory(user_id=user_id, key=fact["key"], value=fact["value"])

        return self.export_user_data(user_id=user_id)

    @staticmethod
    def _extract_memory_from_chats(chats: List[Dict[str, Any]]) -> List[Dict[str, str]]:
        facts: Dict[str, str] = {}
        for chat in chats:
            for msg in chat.get("messages", []):
                if (msg.get("role") or "").lower() != "user":
                    continue
                content = msg.get("content") or msg.get("text") or ""
                lowered = content.lower()
                if "my name is " in lowered:
                    value = content[lowered.index("my name is ") + len("my name is "):].strip(" .,!?\n\t")
                    if value:
                        facts["name"] = value
        return [{"key": key, "value": value} for key, value in facts.items()]

    @staticmethod
    def _row_to_dict(row: Any) -> Dict[str, Any]:
        if row is None:
            return {}

        if isinstance(row, sqlite3.Row):
            return dict(row)

        if isinstance(row, dict):
            return row

        try:
            return dict(row)
        except Exception:
            if hasattr(row, "_mapping"):
                return dict(row._mapping)
            raise


repo = MemoryRepository()
