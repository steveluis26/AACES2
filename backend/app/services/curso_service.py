"""
CursoService — ÚNICA fuente de verdad del dominio Curso (Sprint S: Stabilization).

Elimina la duplicación de lógica de negocio repartida en:
  - clientes.py (crear_curso con trial/subcursos/constancias, get_cursos, get_proximos_cursos)
  - cursos.py (crear_curso, listar_cursos, obtener_curso)

TODAS las operaciones de curso pasan por aquí. Filtro obligatorio de tenant
(organizacion_id). Sin SQL disperso en los endpoints.

Regla de arquitectura (ARCHITECTURE_RULES.md / CONTRACTS.md):
  - Un solo CREATE, un solo LIST, un solo GET, un solo UPDATE, un solo DELETE.
  - "Próximos" es un filtro de listar(), no un endpoint con SQL propio.
  - Ningún endpoint escribe SQL de negocio directo; delega en este servicio.
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Optional, List, Dict, Any
import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status


def _org_id_of(user_data: dict) -> str:
    """Tenant canónico. Nunca sub."""
    return user_data.get("organizacion_id") or user_data.get("org_id") or user_data.get("sub")


def _uid_of(user_data: dict) -> str:
    """Usuario que ejecuta (para creado_por)."""
    return user_data.get("sub")


def _parse_date(val):
    """Parseo flexible de fecha (YYYY-MM-DD, con/sin T, separadores / . -)."""
    if not val:
        return None
    if isinstance(val, date) and not isinstance(val, datetime):
        return val
    if isinstance(val, datetime):
        return val.date()
    s = str(val).strip()
    if "T" in s:
        s = s.split("T")[0]
    try:
        return datetime.fromisoformat(s).date()
    except Exception:
        pass
    for sep in ("/", "-", ".", " "):
        parts = s.split(sep)
        if len(parts) == 3:
            try:
                if len(parts[0]) == 4:
                    y, m, d = int(parts[0]), int(parts[1]), int(parts[2])
                else:
                    d, m, y = int(parts[0]), int(parts[1]), int(parts[2])
                return date(y, m, d)
            except Exception:
                continue
    raise HTTPException(status_code=400, detail="Formato de fecha inválido. Use YYYY-MM-DD")


async def _check_trial_limit(db: AsyncSession, org_id: str, cid: str):
    """Límite de cursos según suscripción/plan (new y old schema)."""
    if org_id:
        sub_res = await db.execute(
            text("""
                SELECT s.cursos_max, p.codigo
                FROM aaces.suscripciones s
                JOIN aaces.planes p ON p.id = s.plan_id
                WHERE s.organizacion_id = :org_id AND s.estatus = 'activa'
                LIMIT 1
            """),
            {"org_id": org_id},
        )
        sub_row = sub_res.fetchone()
        if sub_row:
            cursos_max = int(sub_row[0] or 10)
            plan_name = sub_row[1]
            if plan_name == "trial":
                cnt = await db.execute(
                    text("SELECT count(*) FROM aaces.cursos WHERE cliente_id IN (SELECT id FROM aaces.clientes WHERE organizacion_id = :org_id) AND estado IN ('activo','en_espera','finalizado')"),
                    {"org_id": org_id},
                )
                if int(cnt.scalar() or 0) >= cursos_max:
                    raise HTTPException(
                        status_code=status.HTTP_402_PAYMENT_REQUIRED,
                        detail=f"Has alcanzado el límite de {cursos_max} cursos del plan trial. Actualiza tu plan para crear más cursos.",
                    )
    else:
        plan_res = await db.execute(
            text("SELECT plan, cursos_max FROM aaces.clientes WHERE id = :cid"),
            {"cid": cid},
        )
        plan_row = plan_res.fetchone()
        if plan_row:
            plan_name = plan_row[0]
            cursos_max = int(plan_row[1] or 10)
            if plan_name == "trial":
                cnt = await db.execute(
                    text("SELECT count(*) FROM aaces.cursos WHERE cliente_id = :cid AND estado IN ('activo','en_espera','finalizado')"),
                    {"cid": cid},
                )
                if int(cnt.scalar() or 0) >= cursos_max:
                    raise HTTPException(
                        status_code=status.HTTP_402_PAYMENT_REQUIRED,
                        detail=f"Has alcanzado el límite de {cursos_max} cursos del plan trial. Actualiza tu plan para crear más cursos.",
                    )


async def _asegurar_columnas_precio(db: AsyncSession):
    await db.execute(text("SET LOCAL search_path TO aaces"))
    await db.execute(text("ALTER TABLE IF EXISTS cursos ADD COLUMN IF NOT EXISTS precio_base NUMERIC(10,2) DEFAULT 0"))
    await db.execute(text("ALTER TABLE IF EXISTS cursos ADD COLUMN IF NOT EXISTS precio_promocional NUMERIC(10,2)"))
    await db.execute(text("ALTER TABLE IF EXISTS cursos ADD COLUMN IF NOT EXISTS vigencia_meses INTEGER"))
    await db.execute(text("ALTER TABLE IF EXISTS cursos ALTER COLUMN vigencia_meses DROP DEFAULT"))


async def crear(db: AsyncSession, user_data: dict, payload: Any) -> Dict[str, Any]:
    """
    Crear curso (con subcursos y constancias iniciales).
    ÚNICA implementación. Responde {"id","subcursos","constancias"} para no
    romper el frontend gestion/page.tsx.
    """
    org_id = _org_id_of(user_data)
    cid = _uid_of(user_data)
    if not org_id:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")

    data = payload.dict(exclude_unset=True) if hasattr(payload, "dict") else dict(payload)
    nombre = (data.get("nombre") or "").strip()
    ciudad = (data.get("ciudad") or "").strip()
    empresa = (data.get("empresa_contratante") or "").strip() or None
    if not (nombre and ciudad):
        raise HTTPException(status_code=400, detail="Nombre y ciudad son requeridos")

    await _check_trial_limit(db, org_id, cid)

    fi_dt = _parse_date(data.get("fecha_inicio"))
    ff_dt = _parse_date(data.get("fecha_fin"))
    estado_ins = "en_espera"
    if fi_dt or ff_dt:
        if fi_dt and ff_dt and fi_dt > ff_dt:
            raise HTTPException(status_code=400, detail="fecha_inicio no puede ser mayor que fecha_fin")
        if fi_dt and not ff_dt:
            ff_dt = fi_dt
        estado_ins = "activo"

    def num(v, default=0.0):
        try:
            f = float(v)
            return f if f >= 0 else default
        except Exception:
            return default

    precio_base = num(data.get("precio_base"))
    precio_promocional = num(data.get("precio_promocional"))
    try:
        duracion = int(data.get("duracion_horas", 8) or 8)
    except Exception:
        duracion = 8
    grupo_id = data.get("grupo_id") or None
    vig_raw = data.get("vigencia_meses") or data.get("duracion_validacion")
    vigm = None
    if vig_raw is not None:
        try:
            _v = int(vig_raw)
            vigm = _v if _v > 0 else None
        except Exception:
            vigm = None
    modalidad_in = str(data.get("modalidad") or "presencial").strip().lower()
    modalidad_val = "virtual" if modalidad_in == "virtual" else "presencial"

    await _asegurar_columnas_precio(db)

    code_base = datetime.utcnow().strftime("%Y%m%d")
    suffix = uuid.uuid4().hex[:6].upper()

    q = text("""
        INSERT INTO cursos (id, cliente_id, organizacion_id, codigo_curso, nombre, ciudad, fecha_inicio, fecha_fin, duracion_horas, modalidad, estado, empresa_contratante, grupo_id, precio_base, precio_promocional, vigencia_meses, creado_por, fecha_creacion)
        VALUES (gen_random_uuid(), :org_id, :org_id, :code, :nombre, :ciudad, :fi, :ff, :duracion, :modalidad, :estado, :empresa, :grupo_id, :precio_base, :precio_promocional, :vigencia_meses, :cid, now())
        RETURNING id
    """)
    res = await db.execute(q, {
        "cid": cid, "org_id": org_id, "code": f"CUR-{code_base}-{suffix}",
        "nombre": nombre, "ciudad": ciudad, "fi": fi_dt, "ff": ff_dt,
        "empresa": empresa, "duracion": duracion, "estado": estado_ins,
        "grupo_id": grupo_id, "precio_base": precio_base,
        "precio_promocional": precio_promocional, "vigencia_meses": vigm,
        "modalidad": modalidad_val,
    })
    parent_id = res.scalar()

    # Subcursos
    subcursos_creados = 0
    for sc in (getattr(payload, "subcursos", None) or []):
        sn = (getattr(sc, "nombre", None) or "").strip()
        s_ciudad = (getattr(sc, "ciudad", None) or "").strip()
        if not (sn and s_ciudad):
            continue
        try:
            s_fi = _parse_date(getattr(sc, "fecha_inicio", None))
            s_ff = _parse_date(getattr(sc, "fecha_fin", None))
        except HTTPException:
            continue
        s_estado = "en_espera"
        if s_fi or s_ff:
            if s_fi and s_ff and s_fi > s_ff:
                continue
            if s_fi and not s_ff:
                s_ff = s_fi
            s_estado = "activo"
        s_suffix = uuid.uuid4().hex[:6].upper()
        try:
            s_dur = int(getattr(sc, "duracion_horas", 8) or 8)
        except Exception:
            s_dur = 8
        await db.execute(
            text("""
                INSERT INTO cursos (id, cliente_id, organizacion_id, curso_padre_id, codigo_curso, nombre, ciudad, fecha_inicio, fecha_fin, duracion_horas, modalidad, estado, empresa_contratante, grupo_id, precio_base, precio_promocional, vigencia_meses, creado_por, fecha_creacion)
                VALUES (gen_random_uuid(), :org_id, :org_id, :pid, :code, :nombre, :ciudad, :fi, :ff, :duracion, :modalidad, :estado, :empresa, :grupo_id, :precio_base, :precio_promocional, :vigencia_meses, :cid, now())
                RETURNING id
            """),
            {
                "cid": cid, "org_id": org_id, "pid": parent_id,
                "code": f"CUR-{code_base}-{s_suffix}", "nombre": sn, "ciudad": s_ciudad,
                "fi": s_fi, "ff": s_ff, "duracion": s_dur, "estado": s_estado,
                "empresa": (getattr(sc, "empresa_contratante", None) or "").strip() or None,
                "grupo_id": grupo_id, "precio_base": precio_base,
                "precio_promocional": precio_promocional, "vigencia_meses": vigm,
                "modalidad": modalidad_val,
            },
        )
        subcursos_creados += 1

    # Constancias iniciales (catálogo)
    constancias_creadas = 0
    for cn in (getattr(payload, "constancias", None) or []):
        cn_nombre = (getattr(cn, "nombre", None) or "").strip()
        if not cn_nombre:
            continue
        await db.execute(
            text("""
                INSERT INTO constancias_curso (id, curso_id, nombre)
                VALUES (gen_random_uuid(), :curso_id, :nombre)
            """),
            {"curso_id": parent_id, "nombre": cn_nombre},
        )
        constancias_creadas += 1

    return {
        "id": str(parent_id),
        "subcursos": subcursos_creados,
        "constancias": constancias_creadas,
    }


async def listar(
    db: AsyncSession,
    org_id: str,
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    estado: Optional[str] = None,
    modalidad: Optional[str] = None,
    fecha_inicio_from: Optional[date] = None,
    fecha_inicio_to: Optional[date] = None,
    proximos: bool = False,
) -> Dict[str, Any]:
    """
    Listar cursos del tenant. ÚNICA implementación de listado.
    Si proximos=True, filtra por fecha >= hoy (equivalente a /agenda/proximos).
    """
    params: Dict[str, Any] = {"org_id": org_id, "limit": limit, "skip": skip}
    where = ["cliente_id = :org_id"]
    if search:
        where.append("(nombre ILIKE :search OR descripcion ILIKE :search)")
        params["search"] = f"%{search}%"
    if estado:
        where.append("estado = :estado")
        params["estado"] = estad_o = estado
    if modalidad:
        where.append("modalidad = :modalidad")
        params["modalidad"] = modalidad
    if fecha_inicio_from:
        where.append("fecha_inicio >= :fi_from")
        params["fi_from"] = fecha_inicio_from
    if fecha_inicio_to:
        where.append("fecha_inicio <= :fi_to")
        params["fi_to"] = fecha_inicio_to
    if proximos:
        where.append(
            "((fecha_inicio IS NOT NULL AND fecha_inicio >= CURRENT_DATE) "
            "OR (fecha_inicio IS NULL AND fecha_fin IS NOT NULL AND fecha_fin >= CURRENT_DATE) "
            "OR (fecha_inicio IS NULL AND fecha_fin IS NULL AND estado = 'en_espera'))"
        )

    where_sql = " AND ".join(where)
    count_q = text(f"SELECT count(*) FROM aaces.cursos WHERE {where_sql}")
    total = int((await db.execute(count_q, params)).scalar() or 0)

    rows_q = text(
        f"""
        SELECT id, codigo_curso, nombre, ciudad, fecha_inicio, fecha_fin, estado,
               empresa_contratante, precio_base, precio_promocional, duracion_horas, modalidad,
               fecha_creacion, fecha_actualizacion
        FROM aaces.cursos
        WHERE {where_sql}
        ORDER BY fecha_inicio NULLS LAST, fecha_fin ASC
        LIMIT :limit OFFSET :skip
        """
    )
    rows = (await db.execute(rows_q, params)).fetchall()
    items = [
        {
            "id": str(r[0]), "codigo_curso": r[1], "nombre": r[2], "ciudad": r[3],
            "fecha_inicio": r[4].isoformat() if r[4] else None,
            "fecha_fin": r[5].isoformat() if r[5] else None,
            "estado": r[6], "empresa_contratante": r[7],
            "precio_base": float(r[8]) if r[8] else None,
            "precio_promocional": float(r[9]) if r[9] else None,
            "duracion_horas": r[10], "modalidad": r[11],
            "fecha_creacion": r[12].isoformat() if r[12] else None,
            "fecha_actualizacion": r[13].isoformat() if r[13] else None,
        }
        for r in rows
    ]
    return {"items": items, "total": total, "limit": limit, "skip": skip}


async def obtener(db: AsyncSession, curso_id: str, org_id: str) -> Dict[str, Any]:
    """Obtener un curso por id (verificando tenencia). ÚNICA implementación."""
    row = (
        await db.execute(
            text("""
                SELECT id, codigo_curso, nombre, ciudad, descripcion, fecha_inicio, fecha_fin,
                       duracion_horas, duracion_validacion, modalidad, estado, empresa_contratante,
                       costo_total, precio_base, precio_promocional, vigencia_meses, grupo_id,
                       fecha_creacion, creado_por
                FROM aaces.cursos
                WHERE id = :curso_id AND cliente_id = :org_id
                LIMIT 1
            """),
            {"curso_id": curso_id, "org_id": org_id},
        )
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Curso no encontrado")
    return {
        "id": str(row[0]), "codigo_curso": row[1], "nombre": row[2], "ciudad": row[3],
        "descripcion": row[4],
        "fecha_inicio": row[5].isoformat() if row[5] else None,
        "fecha_fin": row[6].isoformat() if row[6] else None,
        "duracion_horas": row[7],
        "duracion_validacion": row[8],
        "modalidad": row[9], "estado": row[10], "empresa_contratante": row[11],
        "costo_total": float(row[12]) if row[12] else None,
        "precio_base": float(row[13]) if row[13] else None,
        "precio_promocional": float(row[14]) if row[14] else None,
        "vigencia_meses": row[15], "grupo_id": str(row[16]) if row[16] else None,
        "fecha_creacion": row[17].isoformat() if row[17] else None,
        "creado_por": str(row[18]) if row[18] else None,
    }
