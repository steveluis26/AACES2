from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any

from app.core.database import get_db
from app.core.security import get_current_user
from app.services.templates import template_service
from app.schemas import (
    TemplateCreate, TemplateUpdate, TemplateResponse,
    TemplateVersionResponse, TemplateActivateRequest,
)

router = APIRouter()
security = HTTPBearer()


@router.get("/", response_model=list[TemplateResponse])
async def list_templates(
    tipo_documento: str = None,
    solo_activas: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    return await template_service.listar(
        db, current_user, tipo_documento=tipo_documento, solo_activas=solo_activas
    )


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    tpl = await template_service.obtener(db, current_user, template_id=template_id)
    if not tpl:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template no encontrado")
    return tpl


@router.post("/", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    data: TemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    creada_por = current_user.get("id") or current_user.get("sub")
    tpl = await template_service.crear(db, current_user, data.model_dump(), creada_por=creada_por)
    if not tpl:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se pudo crear el template")
    return tpl


@router.post("/{template_group_id}/versiones", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_version(
    template_group_id: str,
    data: TemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    creada_por = current_user.get("id") or current_user.get("sub")
    payload = data.model_dump(exclude_none=True)
    tpl = await template_service.crear_version(
        db, current_user, template_group_id, payload, creada_por=creada_por
    )
    if not tpl:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grupo de template no encontrado")
    return tpl


@router.get("/{template_group_id}/versiones", response_model=list[TemplateVersionResponse])
async def list_versions(
    template_group_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    return await template_service.obtener_versiones(db, current_user, template_group_id)


@router.put("/{template_id}/activar")
async def activate_template(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    ok = await template_service.activar(db, current_user, template_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template no encontrado")
    return {"success": True, "message": "Template activado correctamente"}


@router.delete("/{template_id}")
async def delete_template(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    ok = await template_service.eliminar(db, current_user, template_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template no encontrado")
    return {"success": True, "message": "Template eliminado correctamente"}
