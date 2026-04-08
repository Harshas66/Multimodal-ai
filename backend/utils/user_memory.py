import re
from typing import Dict, List


PATTERNS = [
    ("name", re.compile(r"\bmy name is\s+([A-Za-z][A-Za-z .'-]{0,79})", re.IGNORECASE)),
    ("preferred_name", re.compile(r"\byou can call me\s+([A-Za-z][A-Za-z .'-]{0,79})", re.IGNORECASE)),
    ("location", re.compile(r"\bi (?:live|am based) in\s+([A-Za-z][A-Za-z ,.'-]{0,79})", re.IGNORECASE)),
    ("job", re.compile(r"\bi work as\s+(?:an?\s+)?([A-Za-z][A-Za-z /&'-]{0,79})", re.IGNORECASE)),
    ("company", re.compile(r"\bi work at\s+([A-Za-z0-9][A-Za-z0-9 .,&'-]{0,79})", re.IGNORECASE)),
]


def extract_memory_facts(text: str) -> List[Dict[str, str]]:
    content = str(text or "").strip()
    if not content:
        return []

    facts: Dict[str, str] = {}
    for key, pattern in PATTERNS:
        match = pattern.search(content)
        if not match:
            continue
        value = match.group(1).strip(" .,!?\n\t")
        if value:
            facts[key] = value

    return [{"key": key, "value": value} for key, value in facts.items()]


def format_memory_context(facts: List[Dict[str, str]]) -> str:
    lines = [f"{item['key'].replace('_', ' ').title()}: {item['value']}" for item in facts if item.get("key") and item.get("value")]
    if not lines:
        return ""
    return "User memory:\n" + "\n".join(lines)
