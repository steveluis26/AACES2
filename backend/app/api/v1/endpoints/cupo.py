from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.identity import Identity, get_current_identity, require_org_id
from app.services import cupo as cupo_service

router = APIRouter()


@router.get("")
async def mi_cupo(identity: Identity = Depends(get_current_identity), db: AsyncSession = Depends(get_db)):
    """Constancias emitidas en el periodo, límite del plan y paquetes extra."""
    org_id = await require_org_id(db, identity)
    hoy = datetime.now(ZoneInfo("America/Mexico_City")).date()
    e = await cupo_service.estado(db, org_id)
    hist = cupo_service.historial_completo(await cupo_service.historial(db, org_id), hoy)
    return {**e, "historial": hist, "recomendacion": await cupo_service.recomendar(db, e, hist, hoy)}
