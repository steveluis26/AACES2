from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.api.v1.endpoints.auth import get_current_user_data

router = APIRouter()


class AcreditarSchema(BaseModel):
    calificacion: float = Field(..., ge=0, le=100)


@router.post("/{participante_id}/acreditar")
async def acreditar_participante(
    participante_id: str,
    payload: AcreditarSchema,
    user_data: dict = Depends(get_current_user_data),
    db: AsyncSession = Depends(get_db),
):
    cid = user_data.get("sub")
    if not cid:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")

    await db.execute(text("SET LOCAL search_path TO aaces"))

    cp = await db.execute(
        text("""
            SELECT cp.id FROM aaces.curso_participante cp
            JOIN aaces.cursos c ON c.id = cp.curso_id
            WHERE cp.participante_id = :pid AND c.cliente_id = :cid
            LIMIT 1
        """),
        {"pid": participante_id, "cid": cid},
    )
    cp_row = cp.fetchone()
    if not cp_row:
        raise HTTPException(status_code=404, detail="Participante no encontrado en tus cursos")

    await db.execute(
        text("UPDATE aaces.curso_participante SET estado_acreditacion = true, calificacion = :cal WHERE id = :id"),
        {"cal": payload.calificacion, "id": cp_row[0]},
    )
    await db.commit()
    return {"status": "acreditado", "calificacion": payload.calificacion}
