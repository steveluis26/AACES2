from typing import Optional
from pydantic import BaseModel, Field
from app.core.enums import VerificationType


class VerificarDocumentoQuery(BaseModel):
    codigo: str
    ip: Optional[str] = None
    user_agent: Optional[str] = None
    tipo: VerificationType = VerificationType.LINK
