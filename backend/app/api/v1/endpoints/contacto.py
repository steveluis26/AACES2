from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, func
from typing import Optional, Dict, Any, List
from datetime import datetime
import logging

from app.core.database import get_db
from app.api.v1.endpoints.auth import require_admin
from app.core.logging import audit_logger

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/planes")
async def listar_planes(
    db: AsyncSession = Depends(get_db)
):
    await db.execute(text("SET LOCAL search_path TO aaces"))
    res = await db.execute(
        text("SELECT id, codigo, nombre, descripcion, precio_mensual, cursos_max, usuarios_max, constancias_max, incluye_soporte_prioritario, incluye_api, incluye_white_label FROM aaces.planes WHERE activo = true ORDER BY precio_mensual")
    )
    rows = res.fetchall()
    return {
        "data": [
            {
                "id": str(r[0]), "codigo": r[1], "nombre": r[2],
                "descripcion": r[3], "precio_mensual": float(r[4] or 0),
                "cursos_max": int(r[5] or 0), "usuarios_max": int(r[6] or 0),
                "constancias_max": int(r[7] or 0),
                "incluye_soporte_prioritario": bool(r[8]),
                "incluye_api": bool(r[9]), "incluye_white_label": bool(r[10]),
            }
            for r in rows
        ]
    }


@router.post("/contacto")
async def crear_contacto(
    payload: dict,
    db: AsyncSession = Depends(get_db)
):
    nombre = (payload.get("nombre") or "").strip()
    email = (payload.get("email") or "").strip()
    empresa = (payload.get("empresa") or "").strip() or None
    asunto = (payload.get("asunto") or "soporte").strip()
    mensaje = (payload.get("mensaje") or "").strip()

    if not nombre or not email or not mensaje:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="nombre, email y mensaje son requeridos"
        )
    if "@" not in email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email inválido"
        )
    asuntos_validos = {"soporte", "ventas", "integraciones", "otros"}
    if asunto not in asuntos_validos:
        asunto = "otros"

    await db.execute(text("SET LOCAL search_path TO aaces"))
    res = await db.execute(
        text(
            """
            INSERT INTO aaces.contactos (nombre, email, empresa, asunto, mensaje)
            VALUES (:nombre, :email, :empresa, :asunto, :mensaje)
            RETURNING id, fecha_creacion
            """
        ),
        {"nombre": nombre, "email": email, "empresa": empresa, "asunto": asunto, "mensaje": mensaje}
    )
    row = res.fetchone()
    await db.commit()

    return {
        "success": True,
        "message": "Mensaje recibido. Te contactaremos pronto.",
        "id": str(row[0]),
        "fecha_creacion": row[1].isoformat() if row[1] else None
    }


@router.get("/admin/contacto")
async def listar_contactos(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    leido: Optional[bool] = Query(None),
    asunto: Optional[str] = Query(None),
    search: Optional[str] = Query(None, min_length=2),
    user_data: Dict[str, Any] = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    await db.execute(text("SET LOCAL search_path TO aaces"))
    where_clauses = []
    params: Dict[str, Any] = {}

    if leido is not None:
        where_clauses.append("leido = :leido")
        params["leido"] = leido
    if asunto:
        where_clauses.append("asunto = :asunto")
        params["asunto"] = asunto
    if search:
        where_clauses.append(
            "(nombre ILIKE :search OR email ILIKE :search OR mensaje ILIKE :search OR "
            "COALESCE(empresa, '') ILIKE :search)"
        )
        params["search"] = f"%{search}%"

    where_sql = " WHERE " + " AND ".join(where_clauses) if where_clauses else ""

    total_res = await db.execute(
        text(f"SELECT count(*) FROM aaces.contactos{where_sql}"),
        params
    )
    total = int(total_res.scalar() or 0)

    offset = (page - 1) * per_page
    rows_res = await db.execute(
        text(
            f"""
            SELECT id, nombre, email, empresa, asunto, mensaje, leido, respondido,
                   fecha_creacion, fecha_leido, notas_admin
            FROM aaces.contactos{where_sql}
            ORDER BY fecha_creacion DESC
            LIMIT :limit OFFSET :offset
            """
        ),
        {**params, "limit": per_page, "offset": offset}
    )
    rows = rows_res.fetchall()

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page if total > 0 else 1,
        "data": [
            {
                "id": str(r[0]),
                "nombre": r[1],
                "email": r[2],
                "empresa": r[3],
                "asunto": r[4],
                "mensaje": r[5],
                "leido": r[6],
                "respondido": r[7],
                "fecha_creacion": r[8].isoformat() if r[8] else None,
                "fecha_leido": r[9].isoformat() if r[9] else None,
                "notas_admin": r[10],
            }
            for r in rows
        ]
    }


@router.get("/admin/contacto/{contacto_id}")
async def obtener_contacto(
    contacto_id: str,
    user_data: Dict[str, Any] = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    await db.execute(text("SET LOCAL search_path TO aaces"))
    res = await db.execute(
        text(
            """
            SELECT id, nombre, email, empresa, asunto, mensaje, leido, respondido,
                   fecha_creacion, fecha_leido, notas_admin
            FROM aaces.contactos WHERE id = :id
            """
        ),
        {"id": contacto_id}
    )
    row = res.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")

    # Marcar como leído automáticamente
    if not row[6]:
        await db.execute(
            text("UPDATE aaces.contactos SET leido = true, fecha_leido = now() WHERE id = :id"),
            {"id": contacto_id}
        )
        await db.commit()

    return {
        "id": str(row[0]),
        "nombre": row[1],
        "email": row[2],
        "empresa": row[3],
        "asunto": row[4],
        "mensaje": row[5],
        "leido": row[6],
        "respondido": row[7],
        "fecha_creacion": row[8].isoformat() if row[8] else None,
        "fecha_leido": row[9].isoformat() if row[9] else None,
        "notas_admin": row[10],
    }


@router.put("/admin/contacto/{contacto_id}/status")
async def actualizar_estado_contacto(
    contacto_id: str,
    payload: dict,
    user_data: Dict[str, Any] = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    await db.execute(text("SET LOCAL search_path TO aaces"))
    res = await db.execute(
        text("SELECT id FROM aaces.contactos WHERE id = :id"),
        {"id": contacto_id}
    )
    if not res.fetchone():
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")

    updates = []
    params: Dict[str, Any] = {"id": contacto_id}
    if "leido" in payload:
        updates.append("leido = :leido")
        params["leido"] = bool(payload["leido"])
        if params["leido"]:
            updates.append("fecha_leido = now()")
    if "respondido" in payload:
        updates.append("respondido = :respondido")
        params["respondido"] = bool(payload["respondido"])
    if "notas_admin" in payload:
        updates.append("notas_admin = :notas_admin")
        params["notas_admin"] = str(payload["notas_admin"])

    if not updates:
        return {"updated": 0}

    await db.execute(
        text(f"UPDATE aaces.contactos SET {', '.join(updates)} WHERE id = :id"),
        params
    )
    await db.commit()

    audit_logger.log_user_action(
        user_id=user_data["sub"],
        action="update_contacto_status",
        resource="contacto",
        details={"contacto_id": contacto_id, **payload}
    )

    return {"updated": 1}
