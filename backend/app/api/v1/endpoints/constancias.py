import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.v1.endpoints.auth import require_org_admin
from app.services.constancias import constancias_service
from app.core.logging import audit_logger

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/emitir")
async def emitir_constancia(
    curso_participante_id: str = Query(..., description="ID del registro curso-participante"),
    template_id: Optional[str] = Query(None, description="ID de la plantilla (opcional, usa la CONSTANCIA activa por defecto)"),
    user_data: dict = Depends(require_org_admin),
    db: AsyncSession = Depends(get_db),
):
    organizacion_id = user_data["org_id"]
    try:
        doc = await constancias_service.emitir(
            db=db,
            organizacion_id=organizacion_id,
            curso_participante_id=curso_participante_id,
            emitido_por=user_data.get("sub"),
            template_id=template_id,
        )
        audit_logger.log_user_action(
            user_id=user_data.get("sub"),
            action="constancia_emitida",
            resource="constancias",
            details={"doc_id": doc["id"], "codigo_validacion": doc["codigo_validacion"]},
        )
        return {"success": True, "documento": doc}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception(f"Error emitiendo constancia: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al emitir constancia")


@router.get("")
async def listar_constancias(
    curso_id: Optional[str] = Query(None, description="Filtrar por curso"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user_data: dict = Depends(require_org_admin),
    db: AsyncSession = Depends(get_db),
):
    organizacion_id = user_data["org_id"]
    return await constancias_service.listar(
        db=db,
        organizacion_id=organizacion_id,
        curso_id=curso_id,
        limit=limit,
        offset=offset,
    )
