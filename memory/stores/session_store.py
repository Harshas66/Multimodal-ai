from datetime import datetime, timedelta


class SessionStore:

    def __init__(self):

        self.sessions = {}

    def create_session(self, session_id: str):

        if session_id not in self.sessions:

            self.sessions[session_id] = {
                "messages": [],
                "created_at": datetime.utcnow(),
                "last_active": datetime.utcnow()
            }

    def add_message(
        self,
        session_id: str,
        role: str,
        content: str
    ):

        self.create_session(session_id)

        self.sessions[session_id]["messages"].append({
            "role": role,
            "content": content,
            "timestamp": datetime.utcnow()
        })

        self.sessions[session_id]["last_active"] = datetime.utcnow()

    def get_context(
        self,
        session_id: str,
        limit: int = 10
    ):

        if session_id not in self.sessions:
            return []

        messages = self.sessions[session_id]["messages"]

        return messages[-limit:]

    def delete_session(self, session_id: str):

        if session_id in self.sessions:
            del self.sessions[session_id]

    def cleanup_expired_sessions(
        self,
        expiry_minutes: int = 60
    ):

        current_time = datetime.utcnow()

        expired_sessions = []

        for session_id, data in self.sessions.items():

            inactive_time = (
                current_time - data["last_active"]
            )

            if inactive_time > timedelta(minutes=expiry_minutes):

                expired_sessions.append(session_id)

        for session_id in expired_sessions:
            self.delete_session(session_id)

    def clear_all_sessions(self):

        self.sessions.clear()
