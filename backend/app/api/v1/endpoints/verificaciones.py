import logging
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.v1.endpoints.auth import require_org_admin
from app.services.verificaciones import verification_service
from app.schemas import VerificacionPublicResponse, VerificacionRegistroResponse
from app.core.enums import VerificationType

logger = logging.getLogger(__name__)
router = APIRouter()


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
