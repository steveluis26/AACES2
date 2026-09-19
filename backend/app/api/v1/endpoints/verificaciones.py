import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import uuid

from app.core.database import get_db
from app.core.identity import get_current_identity, get_current_cliente_id, require_org_identity, require_org_id, Identity
from app.services.verificaciones import verification_service
from app.schemas import VerificacionPublicResponse, VerificacionRegistroResponse
from app.core.enums import VerificationType

logger = logging.getLogger(__name__)
router = APIRouter()


async def _org_id_para_listar(db: AsyncSession, identity: Identity) -> str:
    """org_id resuelto desde BD; 403 explícito para plataforma (sin fallback)."""
    return await require_org_id(db, identity)


@router.get("")
async def listar_verificaciones(
    documento_id: Optional[str] = Query(None),
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db),
):
    org_id = await _org_id_para_listar(db, identity)

    await db.execute(text("SET LOCAL search_path TO aaces"))
    if documento_id:
        # La rama por documento también debe filtrar por organización.
        rows = await db.execute(
            text("""
                SELECT v.id, v.documento_id, v.codigo, v.fecha, v.tipo, v.resultado
                FROM aaces.verificaciones v
                JOIN aaces.documentos_emitidos d ON d.id = v.documento_id
                WHERE v.documento_id = :doc_id AND d.organizacion_id = :org_id
                ORDER BY v.fecha DESC
            """),
            {"doc_id": documento_id, "org_id": org_id},
        )
    else:
        rows = await db.execute(
            text("""
                SELECT v.id, v.documento_id, v.codigo, v.fecha, v.tipo, v.resultado
                FROM aaces.verificaciones v
                JOIN aaces.documentos_emitidos d ON d.id = v.documento_id
                WHERE d.organizacion_id = :org_id
                ORDER BY v.fecha DESC
            """),
            {"org_id": org_id},
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
    identity: Identity = Depends(require_org_identity),
    db: AsyncSession = Depends(get_db),
):
    organizacion_id = identity.org_id
    return await verification_service.historial(
        db=db, documento_id=doc_id, organizacion_id=organizacion_id
    )
