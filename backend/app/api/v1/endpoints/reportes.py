import logging
from datetime import date
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.v1.endpoints.auth import get_current_user_data

from app.core.tenant import organization_id
logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/constancias-por-periodo")
async def constancias_por_periodo(
    periodo: str = Query("month", pattern="^(month|quarter|year)$"),
    desde: date | None = Query(None),
    hasta: date | None = Query(None),
    user_data: dict = Depends(get_current_user_data),
    db: AsyncSession = Depends(get_db),
):
    org_id = organization_id(user_data)
    if not org_id:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")
    await db.execute(text("SET LOCAL search_path TO aaces"))

    trunc = {"month": "month", "quarter": "quarter", "year": "year"}[periodo]
    where = "AND d.fecha_emision >= :desde" if desde else ""
    where += " AND d.fecha_emision <= :hasta" if hasta else ""
    sql = text(f"""
        SELECT date_trunc(:trunc, d.fecha_emision) AS periodo, COUNT(*) AS total
        FROM aaces.documentos_emitidos d
        WHERE d.organizacion_id = :org_id {where}
        GROUP BY 1 ORDER BY 1 DESC
    """)
    params: dict[str, Any] = {"org_id": org_id, "trunc": trunc}
    if desde:
        params["desde"] = desde
    if hasta:
        params["hasta"] = hasta
    rows = (await db.execute(sql, params)).fetchall()
    return [{"periodo": str(r[0]), "total": int(r[1])} for r in rows]


@router.get("/tiempo-promedio-emision")
async def tiempo_promedio_emision(
    desde: date | None = Query(None),
    hasta: date | None = Query(None),
    user_data: dict = Depends(get_current_user_data),
    db: AsyncSession = Depends(get_db),
):
    org_id = organization_id(user_data)
    if not org_id:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")
    await db.execute(text("SET LOCAL search_path TO aaces"))

    where = ""
    params: dict[str, Any] = {"org_id": org_id}
    if desde:
        where += " AND d.fecha_emision >= :desde"
        params["desde"] = desde
    if hasta:
        where += " AND d.fecha_emision <= :hasta"
        params["hasta"] = hasta
    sql = text(f"""
        SELECT AVG(EXTRACT(EPOCH FROM (d.fecha_emision - COALESCE(cp.fecha_emision_certificado, d.fecha_emision))) / 86400.0) AS promedio_dias
        FROM aaces.documentos_emitidos d
        JOIN aaces.curso_participante cp ON cp.codigo_validacion = d.codigo_validacion::varchar
        WHERE d.organizacion_id = :org_id {where}
    """)
    row = (await db.execute(sql, params)).fetchone()
    promedio = float(row[0]) if row and row[0] is not None else None
    return {"promedio_dias": round(promedio, 2) if promedio is not None else 0.0}


@router.get("/documentos-no-verificados")
async def documentos_no_verificados(
    limite: int = Query(50, ge=1, le=500),
    user_data: dict = Depends(get_current_user_data),
    db: AsyncSession = Depends(get_db),
):
    org_id = organization_id(user_data)
    if not org_id:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")
    await db.execute(text("SET LOCAL search_path TO aaces"))

    rows = (await db.execute(
        text("""
            SELECT d.id, d.folio, d.tipo_documento, d.fecha_emision, d.estatus
            FROM aaces.documentos_emitidos d
            LEFT JOIN aaces.verificaciones v ON v.documento_id = d.id
            WHERE d.organizacion_id = :org_id AND v.id IS NULL
            ORDER BY d.fecha_emision DESC LIMIT :lim
        """),
        {"org_id": org_id, "lim": limite},
    )).fetchall()
    return [{"id": str(r[0]), "folio": r[1], "tipo_documento": r[2], "fecha_emision": r[3].isoformat() if r[3] else None, "estatus": r[4]} for r in rows]


@router.get("/cursos-top")
async def cursos_top(
    limite: int = Query(10, ge=1, le=50),
    user_data: dict = Depends(get_current_user_data),
    db: AsyncSession = Depends(get_db),
):
    org_id = organization_id(user_data)
    if not org_id:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")
    await db.execute(text("SET LOCAL search_path TO aaces"))

    rows = (await db.execute(
        text("""
            SELECT c.nombre, COUNT(d.id) AS total
            FROM aaces.documentos_emitidos d
            JOIN aaces.curso_participante cp ON cp.codigo_validacion = d.codigo_validacion::varchar
            JOIN aaces.cursos c ON c.id = cp.curso_id
            WHERE d.organizacion_id = :org_id
            GROUP BY c.id, c.nombre ORDER BY total DESC LIMIT :lim
        """),
        {"org_id": org_id, "lim": limite},
    )).fetchall()
    return [{"curso": r[0], "total": int(r[1])} for r in rows]


@router.get("/empresas-top")
async def empresas_top(
    limite: int = Query(10, ge=1, le=50),
    user_data: dict = Depends(get_current_user_data),
    db: AsyncSession = Depends(get_db),
):
    org_id = organization_id(user_data)
    if not org_id:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")
    await db.execute(text("SET LOCAL search_path TO aaces"))

    rows = (await db.execute(
        text("""
            SELECT cl.razon_social, COUNT(d.id) AS total
            FROM aaces.documentos_emitidos d
            JOIN aaces.curso_participante cp ON cp.codigo_validacion = d.codigo_validacion::varchar
            JOIN aaces.cursos c ON c.id = cp.curso_id
            JOIN aaces.organizaciones cl ON cl.id = c.organizacion_id
            WHERE d.organizacion_id = :org_id
            GROUP BY cl.id, cl.razon_social ORDER BY total DESC LIMIT :lim
        """),
        {"org_id": org_id, "lim": limite},
    )).fetchall()
    return [{"empresa": r[0], "total": int(r[1])} for r in rows]


@router.get("/proximos-a-vencer")
async def proximos_a_vencer(
    dias: int = Query(30, ge=1, le=365),
    limite: int = Query(50, ge=1, le=200),
    user_data: dict = Depends(get_current_user_data),
    db: AsyncSession = Depends(get_db),
):
    org_id = organization_id(user_data)
    if not org_id:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")
    await db.execute(text("SET LOCAL search_path TO aaces"))

    rows = (await db.execute(
        text("""
            SELECT d.id, d.folio, d.tipo_documento, d.fecha_emision, d.estatus,
                   cp.fecha_expiracion, c.nombre AS curso, cl.razon_social AS empresa
            FROM aaces.documentos_emitidos d
            JOIN aaces.curso_participante cp ON cp.codigo_validacion = d.codigo_validacion::varchar
            JOIN aaces.cursos c ON c.id = cp.curso_id
            JOIN aaces.organizaciones cl ON cl.id = c.organizacion_id
            WHERE d.organizacion_id = :org_id
              AND cp.fecha_expiracion IS NOT NULL
              AND cp.fecha_expiracion BETWEEN CURRENT_DATE AND CURRENT_DATE + :dias * INTERVAL '1 day'
            ORDER BY cp.fecha_expiracion ASC LIMIT :lim
        """),
        {"org_id": org_id, "dias": dias, "lim": limite},
    )).fetchall()
    return [{"id": str(r[0]), "folio": r[1], "tipo_documento": r[2], "fecha_emision": r[3].isoformat() if r[3] else None, "estatus": r[4], "fecha_expiracion": r[5].isoformat() if r[5] else None, "curso": r[6], "empresa": r[7]} for r in rows]
