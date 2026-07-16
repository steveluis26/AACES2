from pydantic import BaseModel


class DocumentCapabilities(BaseModel):
    cancelar: bool = False
    reemitir: bool = False
    descargar: bool = False
    compartir: bool = False
