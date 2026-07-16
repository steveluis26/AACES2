from typing import Optional, Any
from pydantic import BaseModel, Field


class DocumentoGenerarQuery(BaseModel):
    organizacion_id: str
    template_id: str
    data: dict[str, Any]
    emitido_por: Optional[str] = None
    extra_metadata: Optional[dict[str, Any]] = None
