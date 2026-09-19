"""Centro de notificaciones del cliente (organización).

Lectura del historial de avisos generados por el job diario de recordatorios
y marcado como leídas. Todo va scoping por organización: un usuario solo ve
las notificaciones de su propia org.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.identity import Identity, get_current_identity, require_org_id

router = APIRouter()


@router.get("")
async def listar_notificaciones(
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
):
    org_id = await require_org_id(db, identity)
    rows = (
        await db.execute(
            text(
                """
                SELECT id, tipo, titulo, mensaje, dias_restantes, leida,
                       email_estado, fecha_creacion, fecha_lectura
                FROM aaces.notificaciones
                WHERE organizacion_id = :org
                ORDER BY fecha_creacion DESC
                LIMIT :lim
                """
            ),
            {"org": org_id, "lim": min(max(limit, 1), 200)},
        )
    ).mappings().all()
    return [
        {
            "id": str(r["id"]),
            "tipo": r["tipo"],
            "titulo": r["titulo"],
            "mensaje": r["mensaje"],
            "dias_restantes": r["dias_restantes"],
            "leida": r["leida"],
            "email_estado": r["email_estado"],
            "fecha_creacion": r["fecha_creacion"].isoformat() if r["fecha_creacion"] else None,
            "fecha_lectura": r["fecha_lectura"].isoformat() if r["fecha_lectura"] else None,
        }
        for r in rows
    ]


@router.get("/no-leidas")
async def contar_no_leidas(
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db),
):
    org_id = await require_org_id(db, identity)
    total = (
        await db.execute(
            text(
                """
                SELECT count(*) FROM aaces.notificaciones
                WHERE organizacion_id = :org AND leida = false
                """
            ),
            {"org": org_id},
        )
    ).scalar()
    return {"no_leidas": int(total or 0)}


@router.patch("/{notificacion_id}/leer")
async def marcar_leida(
    notificacion_id: str,
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db),
):
    org_id = await require_org_id(db, identity)
    res = await db.execute(
        text(
            """
            UPDATE aaces.notificaciones
            SET leida = true, fecha_lectura = CURRENT_TIMESTAMP
            WHERE id = :nid AND organizacion_id = :org AND leida = false
            """
        ),
        {"nid": notificacion_id, "org": org_id},
    )
    await db.commit()
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    return {"ok": True}
