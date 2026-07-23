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
                  cl.razon_social AS org_nombre
                FROM aaces.curso_participante cp
                JOIN aaces.cursos c ON c.id = cp.curso_id
                JOIN aaces.organizaciones cl ON cl.id = c.organizacion_id
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
