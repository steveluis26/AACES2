from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel, Field
import uuid

from app.core.database import get_db
from app.api.v1.endpoints.auth import get_current_user_data
from app.services import curso_service as CursoService
from app.services import participante_service as ParticipanteService

router = APIRouter()


class CursoCreateSchema(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=200)
    ciudad: str = Field(..., min_length=1, max_length=100)
    fecha_inicio: date
    fecha_fin: date
    duracion_horas: int = Field(..., ge=1)
    duracion_validacion: int = Field(..., ge=1, description="Vigencia del certificado en meses (obligatoria)")
    vigencia_meses: Optional[int] = Field(None, ge=1, description="Alias de duracion_validacion")
    costo_total: Optional[float] = None
    modalidad: str = Field("presencial", pattern="^(presencial|virtual|mixta)$")
    codigo_curso: str = Field(..., min_length=1, max_length=20)
    estado: str = Field("activo", pattern="^(activo|finalizado|en_espera|cancelado)$")
    empresa_contratante: Optional[str] = None


class CursoResponseSchema(BaseModel):
    id: str
    nombre: str
    ciudad: str
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    duracion_horas: Optional[int] = None
    costo_total: Optional[float] = None
    modalidad: Optional[str] = None
    codigo_curso: Optional[str] = None
    estado: Optional[str] = None
    empresa_contratante: Optional[str] = None
    fecha_creacion: Optional[str] = None


@router.post("", response_model=CursoResponseSchema, status_code=status.HTTP_201_CREATED)
async def crear_curso(
    payload: CursoCreateSchema,
    user_data: dict = Depends(get_current_user_data),
    db: AsyncSession = Depends(get_db),
):
    """Crear curso (DELEGA EN CursoService - única implementación)."""
    org_id = CursoService._org_id_of(user_data)
    if not org_id:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")
    try:
        result = await CursoService.crear(db, user_data, payload)
        await db.commit()
        # Devolver el curso completo (compatible con CursoResponseSchema)
        return await CursoService.obtener(db, result["id"], org_id)
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creando curso: {str(e)}")


@router.get("", response_model=List[CursoResponseSchema])
async def listar_cursos(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    user_data: dict = Depends(get_current_user_data),
    db: AsyncSession = Depends(get_db),
):
    """Listar cursos (DELEGA EN CursoService.listar)."""
    org_id = CursoService._org_id_of(user_data)
    if not org_id:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")
    result = await CursoService.listar(db, org_id, skip=skip, limit=limit)
    return result["items"]


@router.get("/{curso_id}", response_model=CursoResponseSchema)
async def obtener_curso(
    curso_id: str,
    user_data: dict = Depends(get_current_user_data),
    db: AsyncSession = Depends(get_db),
):
    """Obtener curso (DELEGA EN CursoService.obtener)."""
    org_id = CursoService._org_id_of(user_data)
    if not org_id:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")
    return await CursoService.obtener(db, curso_id, org_id)


class ParticipanteCreateSchema(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    curp: Optional[str] = None
    correo: str = Field(..., max_length=255)
    telefono: Optional[str] = None
    empresa: Optional[str] = None
    cargo: Optional[str] = None


@router.post("/{curso_id}/participantes", status_code=status.HTTP_201_CREATED)
async def add_participante(
    curso_id: str,
    payload: ParticipanteCreateSchema,
    user_data: dict = Depends(get_current_user_data),
    db: AsyncSession = Depends(get_db),
):
    """Registrar participante en curso (DELEGA EN ParticipanteService.crear)."""
    try:
        result = await ParticipanteService.crear(db, user_data, payload, curso_id=curso_id)
        await db.commit()
        return result
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error registrando participante: {str(e)}")
