from dataclasses import dataclass, field
from typing import Dict, Any, Optional


@dataclass
class DocumentDefinition:
    html: str
    recursos: Dict[str, Optional[str]] = field(default_factory=dict)
    config: Dict[str, Any] = field(default_factory=dict)


@dataclass
class DocumentResult:
    storage_provider: str
    storage_key: str
    pdf_hash: str
    html_snapshot: str
