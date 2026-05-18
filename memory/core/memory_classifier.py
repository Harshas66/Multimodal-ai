import re

from memory.models.memory_models import (
    MemoryType,
    ConsentStatus,
    SensitivityLevel
)


class MemoryClassifier:

    SENSITIVE_PATTERNS = [
        r"password",
        r"otp",
        r"api[_\s]?key",
        r"credit card",
        r"debit card",
        r"cvv",
        r"bank account",
        r"upi pin"
    ]

    PERSONAL_PATTERNS = [
        r"my name is",
        r"my phone number is",
        r"my email is",
        r"i live in",
        r"my address is",
        r"\b\d{10}\b",
        r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+"
    ]

    IMPORTANT_PATTERNS = [
        r"i prefer",
        r"i like",
        r"my project",
        r"remember that",
        r"i am learning",
        r"teach me",
        r"my goal is",
        r"i work as",
        r"i study",
        r"my favorite"
    ]

    def is_sensitive(self, text: str) -> bool:

        text = text.lower()

        for pattern in self.SENSITIVE_PATTERNS:
            if re.search(pattern, text):
                return True

        return False

    def is_personal(self, text: str) -> bool:

        text = text.lower()

        for pattern in self.PERSONAL_PATTERNS:
            if re.search(pattern, text):
                return True

        return False

    def is_important(self, text: str) -> bool:

        text = text.lower()

        for pattern in self.IMPORTANT_PATTERNS:
            if re.search(pattern, text):
                return True

        return False

    def classify(self, text: str) -> dict:

        if self.is_sensitive(text):

            return {
                "memory_type": None,
                "consent_status": ConsentStatus.DENIED,
                "sensitivity_level": SensitivityLevel.CRITICAL,
                "store_memory": False,
                "reason": "Sensitive data detected"
            }

        if self.is_personal(text):

            return {
                "memory_type": MemoryType.PERSONAL,
                "consent_status": ConsentStatus.PENDING,
                "sensitivity_level": SensitivityLevel.HIGH,
                "store_memory": False,
                "reason": "Personal data requires consent"
            }

        if self.is_important(text):

            return {
                "memory_type": MemoryType.LONG_TERM,
                "consent_status": ConsentStatus.APPROVED,
                "sensitivity_level": SensitivityLevel.LOW,
                "store_memory": True,
                "reason": "Useful long-term memory"
            }

        return {
            "memory_type": MemoryType.TEMPORARY,
            "consent_status": ConsentStatus.DENIED,
            "sensitivity_level": SensitivityLevel.LOW,
            "store_memory": False,
            "reason": "Temporary session memory only"
        }
