from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.core.database import get_db
from app.core.identity import get_current_identity, get_current_cliente_id, require_org_id, Identity

router = APIRouter()


@router.get("")
async def dashboard_kpi(
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db),
):
    # org_id resuelto desde BD; la plataforma no tiene KPIs propios (403 explícito).
    org_id = await require_org_id(db, identity)
    # cliente_id legacy para las tablas que aún no tienen organizacion_id.
    cid = await get_current_cliente_id(db, identity)

    await db.execute(text("SET LOCAL search_path TO aaces"))

    cursos_res = await db.execute(
        text("SELECT count(*) FROM aaces.cursos WHERE cliente_id = :cid"),
        {"cid": cid},
    )
    total_cursos = int(cursos_res.scalar() or 0)

    participantes_res = await db.execute(
        text("""
            SELECT count(DISTINCT cp.participante_id)
            FROM aaces.curso_participante cp
            JOIN aaces.cursos c ON c.id = cp.curso_id
            WHERE c.cliente_id = :cid
        """),
        {"cid": cid},
    )
    total_participantes = int(participantes_res.scalar() or 0)

    acreditados_res = await db.execute(
        text("""
            SELECT count(DISTINCT cp.participante_id)
            FROM aaces.curso_participante cp
            JOIN aaces.cursos c ON c.id = cp.curso_id
            WHERE c.cliente_id = :cid AND cp.estado_acreditacion = true
        """),
        {"cid": cid},
    )
    total_acreditados = int(acreditados_res.scalar() or 0)

    constancias_res = await db.execute(
        text("""
            SELECT count(*) FROM aaces.documentos_emitidos d
            WHERE d.organizacion_id = :org_id
        """),
        {"org_id": org_id},
    )
    constancias_emitidas = int(constancias_res.scalar() or 0)

    return {
        "total_cursos": total_cursos,
        "total_participantes": total_participantes,
        "total_acreditados": total_acreditados,
        "constancias_emitidas": constancias_emitidas,
    }
