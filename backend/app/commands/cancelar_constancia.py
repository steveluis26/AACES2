from pydantic import BaseModel


class CancelarConstanciaCommand(BaseModel):
    organizacion_id: str
    documento_id: str
    cancelado_por: str
