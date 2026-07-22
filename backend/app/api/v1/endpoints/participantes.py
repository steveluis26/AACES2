from __future__ import annotations
import secrets
import string
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.api.v1.endpoints.auth import get_current_user_data

router = APIRouter()


PAX_ALPHABET = string.ascii_uppercase + string.digits


def _generate_pax_id() -> str:
    return "PAX-" + "".join(secrets.choice(PAX_ALPHABET) for _ in range(9))


class AcreditarSchema(BaseModel):
    calificacion: float = Field(..., ge=0, le=100)


# ── Vigencia and renovaciones ────────────────────────────────────


@router.get("/proximos-a-vencer")
async def participantes_proximos_a_vencer(
    dias: int = Query(60, ge=1, le=365),
    empresa: str = Query(""),
    user_data: dict = Depends(get_current_user_data),
    db: AsyncSession = Depends(get_db),
):
    cid = user_data.get("sub")
    if not cid:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")
    await db.execute(text("SET LOCAL search_path TO aaces"))

    if empresa:
        rows = (
            await db.execute(
                text("""
                    SELECT
                      p.id, p.pax_id, p.nombre, p.correo, p.telefono,
                      COALESCE(cp.empresa_participacion, p.empresa) AS empresa_actual,
                      c.nombre AS curso_nombre, c.codigo_curso,
                      cp.fecha_expiracion,
                      CASE
                        WHEN cp.fecha_expiracion < CURRENT_DATE THEN 'vencido'
                        WHEN cp.fecha_expiracion <= CURRENT_DATE + (:dias * INTERVAL '1 day') THEN 'por_vencer'
                        ELSE 'vigente'
                      END AS estado_vigencia,
                      c.id AS curso_id
                    FROM aaces.curso_participante cp
                    JOIN aaces.cursos c ON c.id = cp.curso_id
                    JOIN aaces.participantes p ON p.id = cp.participante_id
                    WHERE c.cliente_id = :cid
                      AND cp.fecha_expiracion IS NOT NULL
                      AND cp.fecha_expiracion <= CURRENT_DATE + (:dias * INTERVAL '1 day')
                      AND COALESCE(cp.empresa_participacion, p.empresa) ILIKE :emp
                    ORDER BY cp.fecha_expiracion ASC
                """),
                {"cid": cid, "dias": dias, "emp": f"%{empresa}%"},
            )
        ).fetchall()
    else:
        rows = (
            await db.execute(
                text("""
                    SELECT
                      p.id, p.pax_id, p.nombre, p.correo, p.telefono,
                      COALESCE(cp.empresa_participacion, p.empresa) AS empresa_actual,
                      c.nombre AS curso_nombre, c.codigo_curso,
                      cp.fecha_expiracion,
                      CASE
                        WHEN cp.fecha_expiracion < CURRENT_DATE THEN 'vencido'
                        WHEN cp.fecha_expiracion <= CURRENT_DATE + (:dias * INTERVAL '1 day') THEN 'por_vencer'
                        ELSE 'vigente'
                      END AS estado_vigencia,
                      c.id AS curso_id
                    FROM aaces.curso_participante cp
                    JOIN aaces.cursos c ON c.id = cp.curso_id
                    JOIN aaces.participantes p ON p.id = cp.participante_id
                    WHERE c.cliente_id = :cid
                      AND cp.fecha_expiracion IS NOT NULL
                      AND cp.fecha_expiracion <= CURRENT_DATE + (:dias * INTERVAL '1 day')
                    ORDER BY cp.fecha_expiracion ASC
                """),
                {"cid": cid, "dias": dias},
            )
        ).fetchall()

    return [
        {
            "participante_id": str(r[0]),
            "pax_id": r[1],
            "nombre": r[2],
            "correo": r[3],
            "telefono": r[4],
            "empresa": r[5],
            "curso_nombre": r[6],
            "codigo_curso": r[7],
            "fecha_expiracion": r[8].isoformat() if r[8] else None,
            "estado_vigencia": r[9],
            "curso_id": str(r[10]),
        }
        for r in rows
    ]


@router.get("/vencimientos-por-empresa")
async def vencimientos_por_empresa(
    user_data: dict = Depends(get_current_user_data),
    db: AsyncSession = Depends(get_db),
):
    cid = user_data.get("sub")
    if not cid:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")
    await db.execute(text("SET LOCAL search_path TO aaces"))

    rows = (
        await db.execute(
            text("""
                SELECT
                  COALESCE(cp.empresa_participacion, p.empresa) AS empresa,
                  COUNT(*) FILTER (WHERE cp.fecha_expiracion >= CURRENT_DATE AND cp.fecha_expiracion <= CURRENT_DATE + INTERVAL '60 days') AS por_vencer,
                  COUNT(*) FILTER (WHERE cp.fecha_expiracion < CURRENT_DATE) AS vencidos,
                  COUNT(*) FILTER (WHERE cp.fecha_expiracion >= CURRENT_DATE + INTERVAL '61 days' OR cp.fecha_expiracion IS NULL) AS vigentes,
                  COUNT(*) AS total
                FROM aaces.curso_participante cp
                JOIN aaces.cursos c ON c.id = cp.curso_id
                JOIN aaces.participantes p ON p.id = cp.participante_id
                WHERE c.cliente_id = :cid
                GROUP BY COALESCE(cp.empresa_participacion, p.empresa)
                ORDER BY por_vencer DESC, vencidos DESC
            """),
            {"cid": cid},
        )
    ).fetchall()

    return [
        {
            "empresa": r[0] or "Sin empresa",
            "por_vencer": r[1],
            "vencidos": r[2],
            "vigentes": r[3],
            "total": r[4],
        }
        for r in rows
    ]


# ── Standalone CRUD ──────────────────────────────────────────────


@router.get("/posibles-duplicados")
async def buscar_posibles_duplicados(
    nombre: str = Query(""),
    correo: str = Query(""),
    telefono: str = Query(""),
    user_data: dict = Depends(get_current_user_data),
    db: AsyncSession = Depends(get_db),
):
    cid = user_data.get("sub")
    if not cid:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")
    await db.execute(text("SET LOCAL search_path TO aaces"))

    rows = (
        await db.execute(
            text("""
                SELECT id, pax_id, nombre, correo, telefono, empresa
                FROM aaces.participantes
                WHERE cliente_id = :cid
                  AND (correo = :correo OR telefono = :telefono)
                LIMIT 10
            """),
            {"cid": cid, "correo": correo, "telefono": telefono},
        )
    ).fetchall()

    results = []
    for r in rows:
        score = 0
        if correo and r[2] and r[2].lower() == correo.lower():
            score += 80
        if telefono and r[4] and r[4] == telefono:
            score += 70
        if nombre and r[2]:
            a, b = nombre.lower().strip(), (r[2] or "").lower().strip()
            if a == b:
                score += 40
            elif len(a) > 2 and len(b) > 2 and (a in b or b in a):
                score += 20
        results.append({
            "id": str(r[0]),
            "pax_id": r[1],
            "nombre": r[2],
            "correo": r[3],
            "telefono": r[4],
            "empresa": r[5],
            "score": min(score, 100),
        })

    return {"posibles_duplicados": results}


@router.get("")
async def list_participantes(
    q: str = Query(""),
    user_data: dict = Depends(get_current_user_data),
    db: AsyncSession = Depends(get_db),
):
    cid = user_data.get("sub")
    if not cid:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")
    await db.execute(text("SET LOCAL search_path TO aaces"))

    if q:
        like = f"%{q}%"
        rows = (
            await db.execute(
                text("""
                    SELECT p.id, p.pax_id, p.nombre, p.correo, p.telefono, p.empresa, p.cargo, p.fecha_creacion
                    FROM aaces.participantes p
                    WHERE p.cliente_id = :cid
                      AND (p.nombre ILIKE :q OR p.correo ILIKE :q OR p.telefono ILIKE :q OR p.empresa ILIKE :q)
                    ORDER BY p.fecha_creacion DESC
                    LIMIT 100
                """),
                {"cid": cid, "q": like},
            )
        ).fetchall()
    else:
        rows = (
            await db.execute(
                text("""
                    SELECT p.id, p.pax_id, p.nombre, p.correo, p.telefono, p.empresa, p.cargo, p.fecha_creacion
                    FROM aaces.participantes p
                    WHERE p.cliente_id = :cid
                    ORDER BY p.fecha_creacion DESC
                    LIMIT 100
                """),
                {"cid": cid},
            )
        ).fetchall()

    return [
        {
            "id": str(r[0]),
            "pax_id": r[1],
            "nombre": r[2],
            "correo": r[3],
            "telefono": r[4],
            "empresa": r[5],
            "cargo": r[6],
            "fecha_creacion": r[7].isoformat() if r[7] else None,
        }
        for r in rows
    ]


@router.get("/{participante_id}", response_model=None)
async def get_participante(
    participante_id: str,
    user_data: dict = Depends(get_current_user_data),
    db: AsyncSession = Depends(get_db),
):
    cid = user_data.get("sub")
    if not cid:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")
    await db.execute(text("SET LOCAL search_path TO aaces"))

    p = (
        await db.execute(
            text("""
                SELECT id, pax_id, nombre, correo, telefono, empresa, cargo,
                       ciudad_origen, fecha_nacimiento, nivel_educacion, direccion,
                       fecha_creacion
                FROM aaces.participantes
                WHERE id = :pid AND cliente_id = :cid
            """),
            {"pid": participante_id, "cid": cid},
        )
    ).fetchone()
    if not p:
        raise HTTPException(status_code=404, detail="Participante no encontrado")

    cursos_rows = (
        await db.execute(
            text("""
                SELECT
                  c.id, c.nombre, c.codigo_curso,
                  c.fecha_inicio, c.fecha_fin,
                  c.duracion_horas, c.modalidad, c.ciudad,
                  c.empresa_contratante,
                  cp.fecha_inicio_vigencia, cp.fecha_expiracion,
                  cp.estado_acreditacion, cp.calificacion
                FROM aaces.curso_participante cp
                JOIN aaces.cursos c ON c.id = cp.curso_id
                WHERE cp.participante_id = :pid
                  AND c.cliente_id = :cid
                ORDER BY c.fecha_inicio DESC NULLS LAST
            """),
            {"pid": participante_id, "cid": cid},
        )
    ).fetchall()

    cursos = []
    constancias_count = 0
    vigentes = 0
    por_vencer = 0
    vencidos = 0
    from datetime import date, timedelta

    today = date.today()

    for c in cursos_rows:
        fexp = c[10]
        estado_acreditacion = c[11]
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

        cursos.append({
            "curso_id": str(c[0]),
            "curso_nombre": c[1],
            "codigo_curso": c[2],
            "fecha_inicio": c[3].isoformat() if c[3] else None,
            "fecha_fin": c[4].isoformat() if c[4] else None,
            "duracion_horas": c[5],
            "modalidad": c[6],
            "ciudad": c[7],
            "empresa_contratante": c[8],
            "fecha_inicio_vigencia": c[9].isoformat() if c[9] else None,
            "fecha_expiracion": c[10].isoformat() if c[10] else None,
            "estado_acreditacion": bool(c[11]) if c[11] is not None else False,
            "calificacion": float(c[12]) if c[12] is not None else None,
            "estado_vigencia": estado_vigencia,
        })

    return {
        "id": str(p[0]),
        "pax_id": p[1],
        "nombre": p[2],
        "correo": p[3],
        "telefono": p[4],
        "empresa": p[5],
        "cargo": p[6],
        "ciudad_origen": p[7],
        "fecha_nacimiento": p[8].isoformat() if p[8] else None,
        "nivel_educacion": p[9],
        "direccion": p[10],
        "fecha_creacion": p[11].isoformat() if p[11] else None,
        "cursos": cursos,
        "total_cursos": len(cursos),
        "vigentes": vigentes,
        "por_vencer": por_vencer,
        "vencidos": vencidos,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_participante(
    payload: dict,
    user_data: dict = Depends(get_current_user_data),
    db: AsyncSession = Depends(get_db),
):
    cid = user_data.get("sub")
    if not cid:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")
    await db.execute(text("SET LOCAL search_path TO aaces"))

    nombre = (payload.get("nombre") or "").strip()
    correo = (payload.get("correo") or "").strip()
    telefono = (payload.get("telefono") or "").strip()
    empresa = (payload.get("empresa") or "").strip()
    cargo = (payload.get("cargo") or "").strip()
    ciudad_origen = (payload.get("ciudad_origen") or "").strip()

    if not nombre:
        raise HTTPException(status_code=400, detail="El nombre es requerido")

    pax_id = _generate_pax_id()
    pid = (
        await db.execute(
            text("""
                INSERT INTO aaces.participantes (id, pax_id, nombre, correo, telefono, empresa, cargo, ciudad_origen, cliente_id, pais)
                VALUES (gen_random_uuid(), :pax_id, :nombre, :correo, :telefono, :empresa, :cargo, :ciudad, :cliente_id, 'Mexico')
                RETURNING id
            """),
            {
                "pax_id": pax_id,
                "nombre": nombre,
                "correo": correo or None,
                "telefono": telefono or None,
                "empresa": empresa or None,
                "cargo": cargo or None,
                "ciudad": ciudad_origen or None,
                "cliente_id": cid,
            },
        )
    ).scalar()
    await db.commit()

    return {"id": str(pid), "pax_id": pax_id, "nombre": nombre}


@router.put("/{participante_id}")
async def update_participante(
    participante_id: str,
    payload: dict,
    user_data: dict = Depends(get_current_user_data),
    db: AsyncSession = Depends(get_db),
):
    cid = user_data.get("sub")
    if not cid:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")
    await db.execute(text("SET LOCAL search_path TO aaces"))

    existing = await db.execute(
        text("SELECT 1 FROM aaces.participantes WHERE id = :pid AND cliente_id = :cid"),
        {"pid": participante_id, "cid": cid},
    )
    if not existing.fetchone():
        raise HTTPException(status_code=404, detail="Participante no encontrado")

    sets = []
    params = {"pid": participante_id}
    for col in ("nombre", "correo", "telefono", "empresa", "cargo", "ciudad_origen"):
        val = payload.get(col)
        if val is not None:
            sets.append(f"{col} = :{col}")
            params[col] = str(val).strip()
    if not sets:
        raise HTTPException(status_code=400, detail="No hay campos para actualizar")

    await db.execute(
        text(f"UPDATE aaces.participantes SET {', '.join(sets)} WHERE id = :pid"),
        params,
    )
    await db.commit()
    return {"status": "actualizado"}


# ── Acreditar ────────────────────────────────────────────────────


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
        text("UPDATE aaces.curso_participante SET acreditado = true, estado_acreditacion = true, calificacion = :cal WHERE id = :id"),
        {"cal": payload.calificacion, "id": cp_row[0]},
    )
    await db.commit()
    return {"status": "acreditado", "calificacion": payload.calificacion}
