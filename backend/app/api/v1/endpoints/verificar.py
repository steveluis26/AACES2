from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import uuid

from app.core.database import get_db

router = APIRouter()


@router.get("/{codigo}")
async def verificar_publico(
    codigo: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    try:
        uuid.UUID(codigo)
    except ValueError:
        raise HTTPException(status_code=400, detail="Código de validación inválido")

    await db.execute(text("SET LOCAL search_path TO aaces"))
    res = await db.execute(
        text("""
            SELECT id, tipo_documento, estatus, codigo_validacion, folio, fecha_emision
            FROM aaces.documentos_emitidos
            WHERE codigo_validacion = :codigo
            LIMIT 1
        """),
        {"codigo": codigo},
    )
    row = res.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    ip = request.client.host if request.client else "0.0.0.0"
    user_agent = request.headers.get("user-agent", "")

    await db.execute(
        text("""
            INSERT INTO aaces.verificaciones (id, documento_id, codigo, fecha, ip, user_agent, tipo, resultado)
            VALUES (:id, :doc_id, :codigo, now(), :ip, :ua, 'API', 'VALIDA')
        """),
        {
            "id": str(uuid.uuid4()), "doc_id": row[0],
            "codigo": codigo, "ip": ip, "ua": user_agent,
        },
    )
    await db.commit()

    return {
        "valida": row[2] == "emitido",
        "codigo_validacion": str(row[3]),
        "tipo_documento": row[1],
        "estatus": row[2],
        "folio": row[4],
        "fecha_emision": row[5].isoformat() if row[5] else None,
    }
