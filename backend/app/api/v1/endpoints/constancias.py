import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date

from app.core.database import get_db
from app.api.v1.endpoints.auth import require_org_admin
from app.services.constancias import constancias_service
from app.schemas import (
    EmitirConstanciaRequest, ConstanciaDetalleResponse,
    ConstanciaListResponse,
    ConstanciaResumenResponse,
)
from app.queries.constancia_list import ConstanciaListQuery
from app.services.constancia_detalle import constancia_detalle_service
from app.core.enums import ConstanciaSort, OrderEnum
from app.core.logging import audit_logger

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/emitir")
async def emitir_constancia(
    payload: EmitirConstanciaRequest,
    user_data: dict = Depends(require_org_admin),
    db: AsyncSession = Depends(get_db),
):
    organizacion_id = user_data["org_id"]
    try:
        doc = await constancias_service.emitir(
            db=db,
            organizacion_id=organizacion_id,
            curso_participante_id=payload.curso_participante_id,
            emitido_por=user_data.get("sub"),
            template_id=payload.template_id,
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


@router.get("", response_model=ConstanciaListResponse)
async def listar_constancias(
    q: Optional[str] = Query(None, max_length=100, description="Búsqueda global (participante, curso, empresa, código, folio)"),
    estado: Optional[str] = Query(None, pattern="^(emitido|cancelado|reemitido)$"),
    curso_id: Optional[str] = Query(None, description="Filtrar por curso"),
    fecha_desde: Optional[date] = Query(None, description="Desde fecha de emisión"),
    fecha_hasta: Optional[date] = Query(None, description="Hasta fecha de emisión"),
    verificada: Optional[bool] = Query(None, description="Filtrar por verificada/no verificada"),
    template_id: Optional[str] = Query(None, description="Filtrar por plantilla"),
    sort: ConstanciaSort = Query(ConstanciaSort.FECHA, description="Campo de ordenamiento"),
    order: OrderEnum = Query(OrderEnum.DESC, description="Dirección de ordenamiento"),
    page: int = Query(1, ge=1, description="Número de página"),
    page_size: int = Query(25, ge=1, le=200, description="Elementos por página"),
    user_data: dict = Depends(require_org_admin),
    db: AsyncSession = Depends(get_db),
):
    organizacion_id = user_data["org_id"]
    query = ConstanciaListQuery(
        q=q, estado=estado, curso_id=curso_id,
        fecha_desde=fecha_desde, fecha_hasta=fecha_hasta,
        verificada=verificada, template_id=template_id,
        sort=sort, order=order, page=page, page_size=page_size,
    )
    return await constancias_service.listar(
        db=db,
        organizacion_id=organizacion_id,
        query=query,
    )


@router.get("/resumen", response_model=ConstanciaResumenResponse)
async def resumen_constancias(
    user_data: dict = Depends(require_org_admin),
    db: AsyncSession = Depends(get_db),
):
    organizacion_id = user_data["org_id"]
    return await constancias_service.resumen(db=db, organizacion_id=organizacion_id)


@router.get("/{constancia_id}", response_model=ConstanciaDetalleResponse)
async def detalle_constancia(
    constancia_id: str,
    user_data: dict = Depends(require_org_admin),
    db: AsyncSession = Depends(get_db),
):
    organizacion_id = user_data["org_id"]
    result = await constancia_detalle_service.obtener(
        db=db, documento_id=constancia_id, organizacion_id=organizacion_id
    )
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Constancia no encontrada")
    return result
