from typing import Optional
from datetime import date
from pydantic import BaseModel, Field
from app.core.enums import ConstanciaSort, OrderEnum


class ConstanciaListQuery(BaseModel):
    q: Optional[str] = Field(None, max_length=100)
    estado: Optional[str] = Field(None, pattern="^(emitido|cancelado|reemitido)$")
    curso_id: Optional[str] = None
    fecha_desde: Optional[date] = None
    fecha_hasta: Optional[date] = None
    verificada: Optional[bool] = None
    template_id: Optional[str] = None
    sort: ConstanciaSort = ConstanciaSort.FECHA
    order: OrderEnum = OrderEnum.DESC
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=25, ge=1, le=200)

    model_config = {"from_attributes": True}
