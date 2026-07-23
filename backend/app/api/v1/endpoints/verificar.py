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
            SELECT d.id, d.tipo_documento, d.estatus, d.codigo_validacion, d.folio, d.fecha_emision,
                   p.nombre AS participante_nombre, p.pax_id AS participante_pax,
                   c.nombre AS curso_nombre, c.ciudad AS curso_ciudad, c.fecha_inicio AS curso_inicio, c.fecha_fin AS curso_fin,
                   o.razon_social AS organizacion, o.rfc AS organizacion_rfc,
                   cp.calificacion, cp.fecha_acreditacion, cp.fecha_expiracion
            FROM aaces.documentos_emitidos d
            LEFT JOIN aaces.curso_participante cp ON cp.id = d.curso_participante_id
            LEFT JOIN aaces.participantes p ON p.id = cp.participante_id
            LEFT JOIN aaces.cursos c ON c.id = cp.curso_id
            LEFT JOIN aaces.organizaciones o ON o.id = c.organizacion_id
            WHERE d.codigo_validacion = :codigo
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
        "participante": row[6],
        "pax_id": row[7],
        "curso": row[8],
        "curso_ciudad": row[9],
        "curso_inicio": row[10].isoformat() if row[10] else None,
        "curso_fin": row[11].isoformat() if row[11] else None,
        "organizacion": row[12],
        "organizacion_rfc": row[13],
        "calificacion": float(row[14]) if row[14] is not None else None,
        "fecha_acreditacion": row[15].isoformat() if row[15] else None,
        "fecha_expiracion": row[16].isoformat() if row[16] else None,
    }
