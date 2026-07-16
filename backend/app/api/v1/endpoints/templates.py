import os
import uuid
import aiofiles
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Request
from fastapi.responses import HTMLResponse
from fastapi.security import HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any, Optional

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.services.templates import template_service
from app.schemas import (
    TemplateCreate, TemplateUpdate, TemplateResponse,
    TemplateVersionResponse, TemplateActivateRequest,
)

router = APIRouter()
security = HTTPBearer()

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"}


@router.post("/upload")
async def upload_resource(
    file: UploadFile = File(...),
    resource_type: str = Form(...),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Formato no permitido: {ext}. Usa: {', '.join(ALLOWED_EXTENSIONS)}")

    org_id = current_user.get("organizacion_id") or current_user.get("id")
    filename = f"{resource_type}_{uuid.uuid4().hex}{ext}"
    relative_path = f"{org_id}/{filename}"
    full_path = os.path.join(settings.UPLOAD_DIR, relative_path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)

    async with aiofiles.open(full_path, "wb") as f:
        content = await file.read()
        await f.write(content)

    url = f"/uploads/{relative_path}"
    return {"url": url, "filename": filename, "resource_type": resource_type}


@router.post("/preview", response_class=HTMLResponse)
async def preview_template(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    body = await request.json()
    template_id = body.get("template_id")
    html_content = body.get("html_template", "")
    data = body.get("data", {})

    if template_id:
        tpl = await template_service.obtener(db, current_user, template_id=template_id)
        if not tpl:
            raise HTTPException(status_code=404, detail="Template no encontrado")
        html_content = tpl.get("html_template", html_content)
        if not data:
            data = {
                "nombre": "María García López",
                "curso": "Curso de Seguridad Industrial",
                "fecha": "15 de julio de 2026",
                "duracion": "40 horas",
                "folio": "AACES-" + uuid.uuid4().hex[:8].upper(),
            }

    for key, val in data.items():
        html_content = html_content.replace("{{" + key + "}}", str(val))

    return html_content


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
