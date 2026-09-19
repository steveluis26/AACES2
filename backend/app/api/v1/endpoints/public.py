from datetime import date, timedelta
from fastapi import APIRouter, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.core.database import get_db
from fastapi import Depends

router = APIRouter()


@router.get("/p/{pax_id}")
async def public_participant_profile(
    pax_id: str,
    db: AsyncSession = Depends(get_db),
):
    await db.execute(text("SET LOCAL search_path TO aaces"))

    p = (
        await db.execute(
            text("""
                SELECT id, nombre, correo, telefono, empresa
                FROM aaces.participantes
                WHERE pax_id = :pax_id
            """),
            {"pax_id": pax_id},
        )
    ).fetchone()
    if not p:
        raise HTTPException(status_code=404, detail="Participante no encontrado")

    cursos_rows = (
        await db.execute(
            text("""
                SELECT
                  c.nombre, c.codigo_curso,
                  c.fecha_inicio, c.fecha_fin,
                  c.duracion_horas, c.modalidad, c.ciudad,
                  cp.fecha_inicio_vigencia, cp.fecha_expiracion,
                  cp.estado_acreditacion,
                  cl.nombre AS org_nombre
                FROM aaces.curso_participante cp
                JOIN aaces.cursos c ON c.id = cp.curso_id
                JOIN aaces.clientes cl ON cl.id = c.cliente_id
                WHERE cp.participante_id = :pid
                ORDER BY c.fecha_inicio DESC NULLS LAST
            """),
            {"pid": p[0]},
        )
    ).fetchall()

    today = date.today()
    cursos = []
    vigentes = 0
    por_vencer = 0
    vencidos = 0
    org_nombre = None

    for c in cursos_rows:
        fexp = c[8]
        estado_vigencia = "sin_vigencia"
        if fexp:
            if fexp < today:
                estado_vigencia = "vencido"
                vencidos += 1
            elif fexp <= today + timedelta(days=60):
                estado_vigencia = "por_vencer"
                por_vencer += 1
            else:
                estado_vigencia = "vigente"
                vigentes += 1

        if not org_nombre and c[10]:
            org_nombre = c[10]

        cursos.append({
            "curso_nombre": c[0],
            "codigo_curso": c[1],
            "fecha_inicio": c[2].isoformat() if c[2] else None,
            "fecha_fin": c[3].isoformat() if c[3] else None,
            "duracion_horas": c[4],
            "modalidad": c[5],
            "ciudad": c[6],
            "fecha_inicio_vigencia": c[7].isoformat() if c[7] else None,
            "fecha_expiracion": c[8].isoformat() if c[8] else None,
            "estado_acreditacion": bool(c[9]) if c[9] is not None else False,
            "estado_vigencia": estado_vigencia,
        })

    return {
        "nombre": p[1],
        "organizacion": org_nombre,
        "cursos": cursos,
        "total_cursos": len(cursos),
        "vigentes": vigentes,
        "por_vencer": por_vencer,
        "vencidos": vencidos,
    }


# ---------------------------------------------------------------------------
# Lista de espera del directorio (V009) — sin autenticación.
# ---------------------------------------------------------------------------

import re as _re
from pydantic import BaseModel as _BaseModel, Field as _Field
from typing import Optional as _Optional

_EMAIL_RE = _re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class ListaEsperaCreate(_BaseModel):
    nombre: str = _Field(..., min_length=1, max_length=200)
    email: str = _Field(..., min_length=3, max_length=255)
    empresa: _Optional[str] = _Field(None, max_length=200)
    ciudad: _Optional[str] = _Field(None, max_length=100)
    tipo: str = _Field("empresa", pattern="^(empresa|agencia)$")
    mensaje: _Optional[str] = None


@router.post("/lista-espera")
async def registrar_lista_espera(
    payload: ListaEsperaCreate,
    db: AsyncSession = Depends(get_db),
):
    """Captura un lead desde /marketplace. Idempotente ante reintentos."""
    email = payload.email.strip().lower()
    if not _EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Correo electrónico inválido")
    await db.execute(text("SET LOCAL search_path TO aaces"))
    # Anti-duplicado simple: mismo correo+tipo en las últimas 24h → ok sin insertar.
    dup = await db.execute(
        text("""
            SELECT 1 FROM lista_espera
            WHERE email = :email AND tipo = :tipo
              AND fecha_creacion > CURRENT_TIMESTAMP - INTERVAL '24 hours'
            LIMIT 1
        """),
        {"email": email, "tipo": payload.tipo},
    )
    if not dup.fetchone():
        await db.execute(
            text("""
                INSERT INTO lista_espera (nombre, email, empresa, ciudad, tipo, mensaje)
                VALUES (:nombre, :email, :empresa, :ciudad, :tipo, :mensaje)
            """),
            {
                "nombre": payload.nombre.strip(),
                "email": email,
                "empresa": (payload.empresa or "").strip() or None,
                "ciudad": (payload.ciudad or "").strip() or None,
                "tipo": payload.tipo,
                "mensaje": (payload.mensaje or "").strip() or None,
            },
        )
        await db.commit()
    return {"ok": True}
