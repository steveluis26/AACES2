"""Perfil público de la organización (V009).

Lo que una empresa verá en el futuro directorio: nombre comercial, logo,
sitio web, descripción, contacto y ubicación. Solo la propia organización
puede leer/editar su perfil (aislado por organizacion_id).
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.identity import get_current_identity, require_org_id, Identity

router = APIRouter()

CAMPOS_PERFIL = (
    "id, rfc, razon_social, nombre_comercial, email_contacto, telefono,"
    " ciudad, estado, direccion, sitio_web, logo_url, descripcion_publica,"
    " stps_registro, stps_validado"
)


class PerfilUpdate(BaseModel):
    nombre_comercial: Optional[str] = Field(None, max_length=200)
    email_contacto: Optional[str] = Field(None, max_length=255)
    telefono: Optional[str] = Field(None, max_length=20)
    ciudad: Optional[str] = Field(None, max_length=100)
    estado: Optional[str] = Field(None, max_length=100)
    direccion: Optional[str] = None
    sitio_web: Optional[str] = Field(None, max_length=255)
    logo_url: Optional[str] = Field(None, max_length=500)
    descripcion_publica: Optional[str] = None


def _row_to_perfil(r) -> dict:
    return {
        "id": str(r[0]),
        "rfc": r[1],
        "razon_social": r[2],
        "nombre_comercial": r[3],
        "email_contacto": r[4],
        "telefono": r[5],
        "ciudad": r[6],
        "estado": r[7],
        "direccion": r[8],
        "sitio_web": r[9],
        "logo_url": r[10],
        "descripcion_publica": r[11],
        "stps_registro": r[12],
        "stps_validado": bool(r[13]),
    }


@router.get("/perfil")
async def obtener_perfil(
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db),
):
    org_id = await require_org_id(db, identity)
    await db.execute(text("SET LOCAL search_path TO aaces"))
    res = await db.execute(
        text(f"SELECT {CAMPOS_PERFIL} FROM organizaciones WHERE id = :org_id LIMIT 1"),
        {"org_id": org_id},
    )
    row = res.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Organización no encontrada")
    return _row_to_perfil(row)


@router.put("/perfil")
async def actualizar_perfil(
    payload: PerfilUpdate,
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db),
):
    org_id = await require_org_id(db, identity)
    await db.execute(text("SET LOCAL search_path TO aaces"))
    campos = payload.model_dump(exclude_unset=True)
    if not campos:
        raise HTTPException(status_code=400, detail="Sin cambios")
    # Normalizar URL del sitio
    if campos.get("sitio_web"):
        sw = campos["sitio_web"].strip()
        if sw and not sw.startswith(("http://", "https://")):
            sw = "https://" + sw
        campos["sitio_web"] = sw or None
    sets = []
    params: dict = {"org_id": org_id}
    for k, v in campos.items():
        if isinstance(v, str):
            v = v.strip() or None
        sets.append(f"{k} = :{k}")
        params[k] = v
    sets.append("fecha_actualizacion = CURRENT_TIMESTAMP")
    await db.execute(
        text(f"UPDATE organizaciones SET {', '.join(sets)} WHERE id = :org_id"),
        params,
    )
    await db.commit()
    res = await db.execute(
        text(f"SELECT {CAMPOS_PERFIL} FROM organizaciones WHERE id = :org_id LIMIT 1"),
        {"org_id": org_id},
    )
    return _row_to_perfil(res.fetchone())
