from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.archivos import obtener_pdf

router = APIRouter()


@router.get("/{clave:path}")
async def descargar_archivo(clave: str, db: AsyncSession = Depends(get_db)):
    """PDF de una constancia emitida. Igual que el antiguo /storage, la liga es pública
    pero no adivinable (la clave lleva el UUID de la organización y el código)."""
    existe = (await db.execute(
        text("SELECT 1 FROM aaces.documentos_emitidos WHERE storage_key = :k AND estatus <> 'cancelado' LIMIT 1"),
        {"k": clave},
    )).fetchone()
    if not existe:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    pdf = await obtener_pdf(db, clave)
    if not pdf:
        raise HTTPException(status_code=404, detail="No se pudo recuperar el PDF")
    nombre = clave.rsplit("/", 1)[-1]
    if not nombre.endswith(".pdf"):
        nombre = "constancia.pdf"
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="{nombre}"'})
