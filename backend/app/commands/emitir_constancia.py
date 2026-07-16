from typing import Optional
from pydantic import BaseModel


class EmitirConstanciaCommand(BaseModel):
    organizacion_id: str
    curso_participante_id: str
    emitido_por: Optional[str] = None
    template_id: Optional[str] = None
