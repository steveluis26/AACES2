import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import uuid

from app.core.database import get_db
from app.api.v1.endpoints.auth import require_org_admin, get_current_user_data
from app.services.verificaciones import verification_service
from app.schemas import VerificacionPublicResponse, VerificacionRegistroResponse
from app.core.enums import VerificationType

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("")
async def listar_verificaciones(
    documento_id: Optional[str] = Query(None),
    user_data: dict = Depends(get_current_user_data),
    db: AsyncSession = Depends(get_db),
):
    cid = user_data.get("sub")
    if not cid:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")

    await db.execute(text("SET LOCAL search_path TO aaces"))
    if documento_id:
        rows = await db.execute(
            text("""
                SELECT id, documento_id, codigo, fecha, tipo, resultado
                FROM aaces.verificaciones
                WHERE documento_id = :doc_id
                ORDER BY fecha DESC
            """),
            {"doc_id": documento_id},
        )
    else:
        rows = await db.execute(
            text("""
                SELECT v.id, v.documento_id, v.codigo, v.fecha, v.tipo, v.resultado
                FROM aaces.verificaciones v
                JOIN aaces.documentos_emitidos d ON d.id = v.documento_id
                JOIN aaces.organizaciones o ON o.id = d.organizacion_id
                JOIN aaces.clientes cl ON cl.organizacion_id = o.id
                WHERE cl.id = :cid
                ORDER BY v.fecha DESC
            """),
            {"cid": cid},
        )
    data = rows.fetchall()
    return {
        "verificaciones": [
            {
                "id": str(r[0]), "documento_id": str(r[1]),
                "codigo": str(r[2]), "fecha": r[3].isoformat() if r[3] else None,
                "tipo": r[4], "resultado": r[5],
            }
            for r in data
        ]
    }


@router.get("/{codigo}", response_model=VerificacionPublicResponse)
async def verificar_documento(
    codigo: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ip = request.client.host if request.client else "0.0.0.0"
    user_agent = request.headers.get("user-agent", "")
    return await verification_service.verify(
        db=db, codigo=codigo, ip=ip, user_agent=user_agent, tipo=VerificationType.QR
    )


@router.get("/documentos/{doc_id}/verificaciones", response_model=list[VerificacionRegistroResponse])
async def historial_verificaciones(
    doc_id: str,
    user_data: dict = Depends(require_org_admin),
    db: AsyncSession = Depends(get_db),
):
    organizacion_id = user_data["org_id"]
    return await verification_service.historial(
        db=db, documento_id=doc_id, organizacion_id=organizacion_id
    )
