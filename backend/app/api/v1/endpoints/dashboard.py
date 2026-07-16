from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any

from app.core.database import get_db
from app.core.security import get_current_user
from app.services.dashboard import dashboard_service
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/resumen")
async def resumen(
    db: AsyncSession = Depends(get_db),
    user_data: Dict[str, Any] = Depends(get_current_user),
):
    return await dashboard_service.get_resumen(db, user_data)


@router.get("/alertas")
async def alertas(
    db: AsyncSession = Depends(get_db),
    user_data: Dict[str, Any] = Depends(get_current_user),
):
    return await dashboard_service.get_alertas(db, user_data)


@router.get("/agenda")
async def agenda(
    db: AsyncSession = Depends(get_db),
    user_data: Dict[str, Any] = Depends(get_current_user),
):
    return await dashboard_service.get_agenda(db, user_data)


@router.get("/actividad")
async def actividad(
    db: AsyncSession = Depends(get_db),
    user_data: Dict[str, Any] = Depends(get_current_user),
):
    return await dashboard_service.get_actividad(db, user_data)


@router.get("/graficas")
async def graficas(
    db: AsyncSession = Depends(get_db),
    user_data: Dict[str, Any] = Depends(get_current_user),
):
    return await dashboard_service.get_graficas(db, user_data)


@router.get("/confianza")
async def confianza(
    db: AsyncSession = Depends(get_db),
    user_data: Dict[str, Any] = Depends(get_current_user),
):
    return await dashboard_service.get_confianza(db, user_data)


@router.get("/onboarding")
async def onboarding(
    db: AsyncSession = Depends(get_db),
    user_data: Dict[str, Any] = Depends(get_current_user),
):
    return await dashboard_service.get_onboarding(db, user_data)
