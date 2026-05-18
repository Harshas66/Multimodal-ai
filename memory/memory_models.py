# memory/memory_models.py
from enum import Enum  # We use Enum to create fixed categories. personal, session, long term
from pydantic import BaseModdel        # Helps to validate data, create schemas, serialize JSON, prevent invalid memory objects
from typing import Optional             # optional means field may be empty.
from datetime import datetime          # need for timestamps, memory lifecycle, sync, expiration

# Adding memory Types
class MemoryType(str, Enum):
    SESSION = "session"
    LONG_TERM = "long_term"
    SEMANTIC = "semantic"              # Vector-searchable intelligence memory.
    PERSONAL = "personal"              # Sensitive user data.
    TEMPORARY = "temporary"

# ADDING CONSENT STATUS
class ConsentStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    DENIED = "denied"

# ADD SENSITIVITY LEVELS
class SensitivityLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

# CREATING MAIN MEMORY MODEL
class Memory(BaseModel):

    id: str

    user_id: str

    content: str

    memory_type: MemoryType

    consent_status: ConsentStatus

    sensitivity_level: SensitivityLevel

    importance_score: float = 0.5

    created_at: datetime

    updated_at: datetime

    expires_at: Optional[datetime] = None

    embedding_id: Optional[str] = None

    session_id: Optional[str] = None

    chat_id: Optional[str] = None
