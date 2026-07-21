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

router = APIRouter()


class CursoCreateSchema(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=200)
    ciudad: str = Field(..., min_length=1, max_length=100)
    fecha_inicio: date
    fecha_fin: date
    duracion_horas: int = Field(..., ge=1)
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
    cid = user_data.get("sub")
    if not cid:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")

    if payload.fecha_inicio and payload.fecha_fin and payload.fecha_inicio > payload.fecha_fin:
        raise HTTPException(status_code=400, detail="fecha_inicio no puede ser mayor que fecha_fin")

    await db.execute(text("SET LOCAL search_path TO aaces"))

    code = payload.codigo_curso or f"CUR-{uuid.uuid4().hex[:8].upper()}"
    estado = payload.estado or "activo"

    res = await db.execute(
        text("""
            INSERT INTO aaces.cursos (id, cliente_id, codigo_curso, nombre, ciudad, fecha_inicio, fecha_fin, duracion_horas, modalidad, estado, empresa_contratante, costo_total, creado_por, fecha_creacion)
            VALUES (gen_random_uuid(), :cid, :code, :nombre, :ciudad, :fi, :ff, :duracion, :modalidad, :estado, :empresa, :costo, :cid, now())
            RETURNING id, nombre, ciudad, fecha_inicio, fecha_fin, duracion_horas, modalidad, codigo_curso, estado, empresa_contratante, costo_total, fecha_creacion
        """),
        {
            "cid": cid, "code": code, "nombre": payload.nombre,
            "ciudad": payload.ciudad, "fi": payload.fecha_inicio,
            "ff": payload.fecha_fin, "duracion": payload.duracion_horas,
            "modalidad": payload.modalidad, "estado": estado,
            "empresa": payload.empresa_contratante, "costo": payload.costo_total,
        },
    )
    row = res.fetchone()
    if not row:
        raise HTTPException(status_code=500, detail="Error al crear curso")

    await db.commit()

    return {
        "id": str(row[0]),
        "nombre": row[1],
        "ciudad": row[2],
        "fecha_inicio": row[3],
        "fecha_fin": row[4],
        "duracion_horas": row[5],
        "modalidad": row[6],
        "codigo_curso": row[7],
        "estado": row[8],
        "empresa_contratante": row[9],
        "costo_total": float(row[10]) if row[10] else None,
        "fecha_creacion": row[11].isoformat() if row[11] else None,
    }


@router.get("", response_model=List[CursoResponseSchema])
async def listar_cursos(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    user_data: dict = Depends(get_current_user_data),
    db: AsyncSession = Depends(get_db),
):
    cid = user_data.get("sub")
    if not cid:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")

    await db.execute(text("SET LOCAL search_path TO aaces"))
    res = await db.execute(
        text("""
            SELECT id, nombre, ciudad, fecha_inicio, fecha_fin, duracion_horas, modalidad, codigo_curso, estado, empresa_contratante, costo_total, fecha_creacion
            FROM aaces.cursos
            WHERE cliente_id = :cid
            ORDER BY fecha_creacion DESC
            LIMIT :limit OFFSET :skip
        """),
        {"cid": cid, "limit": limit, "skip": skip},
    )
    rows = res.fetchall()
    return [
        {
            "id": str(r[0]),
            "nombre": r[1],
            "ciudad": r[2],
            "fecha_inicio": r[3],
            "fecha_fin": r[4],
            "duracion_horas": r[5],
            "modalidad": r[6],
            "codigo_curso": r[7],
            "estado": r[8],
            "empresa_contratante": r[9],
            "costo_total": float(r[10]) if r[10] else None,
            "fecha_creacion": r[11].isoformat() if r[11] else None,
        }
        for r in rows
    ]


@router.get("/{curso_id}", response_model=CursoResponseSchema)
async def obtener_curso(
    curso_id: str,
    user_data: dict = Depends(get_current_user_data),
    db: AsyncSession = Depends(get_db),
):
    cid = user_data.get("sub")
    if not cid:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")

    await db.execute(text("SET LOCAL search_path TO aaces"))
    res = await db.execute(
        text("""
            SELECT id, nombre, ciudad, fecha_inicio, fecha_fin, duracion_horas, modalidad, codigo_curso, estado, empresa_contratante, costo_total, fecha_creacion
            FROM aaces.cursos
            WHERE id = :curso_id AND cliente_id = :cid
            LIMIT 1
        """),
        {"curso_id": curso_id, "cid": cid},
    )
    row = res.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Curso no encontrado")

    return {
        "id": str(row[0]),
        "nombre": row[1],
        "ciudad": row[2],
        "fecha_inicio": row[3],
        "fecha_fin": row[4],
        "duracion_horas": row[5],
        "modalidad": row[6],
        "codigo_curso": row[7],
        "estado": row[8],
        "empresa_contratante": row[9],
        "costo_total": float(row[10]) if row[10] else None,
        "fecha_creacion": row[11].isoformat() if row[11] else None,
    }


class ParticipanteCreateSchema(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    curp: Optional[str] = None
    correo: str = Field(..., max_length=255)


@router.post("/{curso_id}/participantes", status_code=status.HTTP_201_CREATED)
async def add_participante(
    curso_id: str,
    payload: ParticipanteCreateSchema,
    user_data: dict = Depends(get_current_user_data),
    db: AsyncSession = Depends(get_db),
):
    cid = user_data.get("sub")
    if not cid:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")

    await db.execute(text("SET LOCAL search_path TO aaces"))

    own = await db.execute(
        text("SELECT 1 FROM aaces.cursos WHERE id = :id AND cliente_id = :cid"),
        {"id": curso_id, "cid": cid},
    )
    if own.scalar() is None:
        raise HTTPException(status_code=404, detail="Curso no encontrado")

    nombre = payload.nombre.strip()
    correo = payload.correo.strip()
    if not (nombre and correo):
        raise HTTPException(status_code=400, detail="nombre y correo requeridos")

    pid = None
    ex_mail = await db.execute(
        text("SELECT id FROM aaces.participantes WHERE correo = :correo"),
        {"correo": correo},
    )
    row_mail = ex_mail.fetchone()
    if row_mail:
        pid = row_mail[0]

    if not pid:
        pax_id = f"PAX-{uuid.uuid4().hex[:8].upper()}"
        ins = await db.execute(
            text("""
                INSERT INTO aaces.participantes (id, pax_id, nombre, correo, pais)
                VALUES (gen_random_uuid(), :pax_id, :nombre, :correo, 'Mexico')
                RETURNING id
            """),
            {"pax_id": pax_id, "nombre": nombre, "correo": correo},
        )
        pid = ins.scalar()

    ex_global = await db.execute(
        text("SELECT id FROM aaces.curso_participante WHERE curso_id = :curso AND participante_id = :pid"),
        {"curso": curso_id, "pid": pid},
    )
    cp_id = ex_global.scalar()

    if not cp_id:
        lnk = await db.execute(
            text("""
                INSERT INTO aaces.curso_participante (id, curso_id, participante_id, estado_pago, estado_acreditacion, valor_pagado, costo_asignado, descuento)
                VALUES (gen_random_uuid(), :curso, :pid, 'pendiente', false, 0, 0, 0)
                RETURNING id
            """),
            {"curso": curso_id, "pid": pid},
        )
        cp_id = lnk.scalar()

    await db.commit()
    return {"id": str(cp_id), "participante_id": str(pid), "curso_participante_id": str(cp_id)}
