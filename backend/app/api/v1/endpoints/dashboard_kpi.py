from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.core.database import get_db
from app.api.v1.endpoints.auth import get_current_user_data

router = APIRouter()


@router.get("")
async def dashboard_kpi(
    user_data: dict = Depends(get_current_user_data),
    db: AsyncSession = Depends(get_db),
):
    cid = user_data.get("sub")
    if not cid:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")

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
            JOIN aaces.organizaciones o ON o.id = d.organizacion_id
            JOIN aaces.clientes cl ON cl.organizacion_id = o.id
            WHERE cl.id = :cid
        """),
        {"cid": cid},
    )
    constancias_emitidas = int(constancias_res.scalar() or 0)

    return {
        "total_cursos": total_cursos,
        "total_participantes": total_participantes,
        "total_acreditados": total_acreditados,
        "constancias_emitidas": constancias_emitidas,
    }
