"""
ConstanciaService — ÚNICA fuente de verdad del dominio Constancia (Sprint S3).

El núcleo de emisión (PDF + QR + hash) ya vive en app.services.constancias.constancias_service.
Esta fachada:
- re-expone emitir() (delega al servicio existente, sin duplicar la generación de PDF).
- centraliza listar / resumen / obtener / cancelar / reemitir / timeline, que hoy
  están como SQL suelto en constancias.py (regla #2: los routers no conocen SQL).

Regla #1: emitir constancia = ConstanciaService.emitir(). Una sola implementación.
Regla #2: los endpoints de constancias.py delegan aquí.
Regla #4: toda consulta filtra por organizacion_id.
"""

from typing import Optional, Dict, Any
from sqlalchemy import text
from fastapi import HTTPException
import uuid

# Servicio existente de emisión (PDF/QR/hash) — no se duplica.
from app.services.constancias import constancias_service as _constancias_mod
_emitir_interno = _constancias_mod.emitir


def _org_id_of(user_data: dict) -> Optional[str]:
    return user_data.get("organizacion_id") or user_data.get("org_id") or user_data.get("sub")


async def emitir(db, user_data: dict, curso_participante_id: str, template_id=None) -> dict:
    """Emitir constancia (PDF+QR+hash). Una sola implementación."""
    org_id = _org_id_of(user_data)
    if not org_id:
        # fallback: resolver org desde cliente
        cid = user_data.get("sub")
        if cid:
            row = await db.execute(
                text("SELECT organizacion_id FROM aaces.clientes WHERE id=:cid"),
                {"cid": cid},
            )
            r = row.fetchone()
            org_id = str(r[0]) if r and r[0] else None
    if not org_id:
        raise HTTPException(status_code=403, detail="Se requiere una organización asociada")
    try:
        return await _emitir_interno(
            db=db,
            organizacion_id=org_id,
            curso_participante_id=curso_participante_id,
            emitido_por=user_data.get("sub") if user_data.get("source") == "usuario" else None,
            template_id=template_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al emitir constancia: {str(e)}")


async def listar(db, user_data: dict, q=None, estado=None, curso_id=None, folio=None,
                 fecha_desde=None, fecha_hasta=None, page=1, page_size=25) -> dict:
    """Listar constancias del tenant (filtra por organizacion_id vía JOIN)."""
    org_id = _org_id_of(user_data)
    if not org_id:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")

    conditions = ["d.organizacion_id = :org_id"]
    params: Dict[str, Any] = {"org_id": org_id}

    if q:
        conditions.append("(d.folio ILIKE :q OR CAST(d.codigo_validacion AS text) ILIKE :q)")
        params["q"] = f"%{q}%"
    if folio:
        conditions.append("d.folio = :folio")
        params["folio"] = folio
    if estado:
        conditions.append("d.estatus = :estado")
        params["estado"] = estado
    if curso_id:
        conditions.append(
            "d.codigo_validacion::text IN (SELECT cp.codigo_validacion::text FROM aaces.curso_participante cp WHERE cp.curso_id = :curso_id)"
        )
        params["curso_id"] = curso_id
    if fecha_desde:
        conditions.append("d.fecha_emision >= :fdesde")
        params["fdesde"] = fecha_desde
    if fecha_hasta:
        conditions.append("d.fecha_emision <= :fhasta")
        params["fhasta"] = fecha_hasta

    where_clause = " AND ".join(conditions)
    count_res = await db.execute(
        text(f"SELECT count(*) FROM aaces.documentos_emitidos d WHERE {where_clause}"),
        params,
    )
    total = int(count_res.scalar() or 0)
    total_pages = max(1, (total + page_size - 1) // page_size)
    offset = (page - 1) * page_size

    res = await db.execute(
        text(f"""
            SELECT d.id, d.tipo_documento, d.estatus, d.codigo_validacion, d.folio, d.fecha_emision,
                   COALESCE(p.nombre || ' ' || p.apellido, '') AS participante_nombre,
                   COALESCE(c.nombre, '') AS curso_nombre,
                   COALESCE(v.cnt, 0) AS verificaciones_count
            FROM aaces.documentos_emitidos d
            LEFT JOIN aaces.curso_participante cp ON cp.codigo_validacion::text = d.codigo_validacion::text
            LEFT JOIN aaces.participantes p ON p.id = cp.participante_id
            LEFT JOIN aaces.cursos c ON c.id = cp.curso_id
            LEFT JOIN (SELECT codigo_validacion, count(*) AS cnt FROM aaces.validaciones_publicas GROUP BY codigo_validacion) v
                   ON v.codigo_validacion::text = d.codigo_validacion::text
            WHERE {where_clause}
            ORDER BY d.fecha_emision DESC
            LIMIT :limit OFFSET :offset
        """),
        {**params, "limit": page_size, "offset": offset},
    )
    rows = res.fetchall()
    items = [
        {
            "id": str(r[0]), "tipo_documento": r[1], "estatus": r[2],
            "codigo_validacion": str(r[3]), "folio": r[4],
            "fecha_emision": r[5].isoformat() if r[5] else None,
            "participante_nombre": (r[6] or "").strip(),
            "curso_nombre": r[7] or "",
            "verificaciones_count": int(r[8] or 0),
        }
        for r in rows
    ]
    return {
        "items": items,
        "pagination": {"page": page, "page_size": page_size, "total": total, "total_pages": total_pages},
        "meta": {"filters_applied": len(conditions), "query_time_ms": 0},
    }


async def resumen(db, user_data: dict) -> dict:
    org_id = _org_id_of(user_data)
    if not org_id:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")
    total = await db.execute(
        text("SELECT count(*) FROM aaces.documentos_emitidos WHERE organizacion_id = :org"),
        {"org": org_id},
    )
    emitidas = await db.execute(
        text("SELECT count(*) FROM aaces.documentos_emitidos WHERE organizacion_id = :org AND estatus = 'emitido'"),
        {"org": org_id},
    )
    canceladas = await db.execute(
        text("SELECT count(*) FROM aaces.documentos_emitidos WHERE organizacion_id = :org AND estatus = 'cancelado'"),
        {"org": org_id},
    )
    return {"total": int(total.scalar() or 0), "emitidas": int(emitidas.scalar() or 0), "canceladas": int(canceladas.scalar() or 0)}


async def obtener(db, user_data: dict, constancia_id: str, base_url: str = "") -> dict:
    org_id = _org_id_of(user_data)
    if not org_id:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")
    res = await db.execute(
        text("""
            SELECT id, tipo_documento, estatus, codigo_validacion, folio, fecha_emision, storage_key
            FROM aaces.documentos_emitidos WHERE id = :id AND organizacion_id = :org LIMIT 1
        """),
        {"id": constancia_id, "org": org_id},
    )
    row = res.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Constancia no encontrada")
    pdf_url = f"{base_url.rstrip('/')}/api/v1/constancias/{constancia_id}/pdf" if base_url else ""
    return {
        "id": str(row[0]), "tipo_documento": row[1], "estatus": row[2],
        "codigo_validacion": str(row[3]), "folio": row[4],
        "fecha_emision": row[5].isoformat() if row[5] else None,
        "pdf_url": pdf_url, "storage_key": row[6],
    }


async def cancelar(db, user_data: dict, constancia_id: str) -> dict:
    org_id = _org_id_of(user_data)
    if not org_id:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")
    res = await db.execute(
        text("SELECT estatus FROM aaces.documentos_emitidos WHERE id = :id AND organizacion_id = :org LIMIT 1"),
        {"id": constancia_id, "org": org_id},
    )
    row = res.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Constancia no encontrada")
    if row[0] == "cancelado":
        raise HTTPException(status_code=400, detail="La constancia ya está cancelada")
    await db.execute(
        text("UPDATE aaces.documentos_emitidos SET estatus = 'cancelado' WHERE id = :id AND organizacion_id = :org"),
        {"id": constancia_id, "org": org_id},
    )
    return {"status": "cancelado"}


async def reemitir(db, user_data: dict, constancia_id: str) -> dict:
    org_id = _org_id_of(user_data)
    if not org_id:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")
    res = await db.execute(
        text("SELECT organizacion_id, tipo_documento FROM aaces.documentos_emitidos WHERE id = :id AND organizacion_id = :org LIMIT 1"),
        {"id": constancia_id, "org": org_id},
    )
    row = res.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Constancia no encontrada")
    await db.execute(
        text("UPDATE aaces.documentos_emitidos SET estatus = 'reemitido' WHERE id = :id AND organizacion_id = :org"),
        {"id": constancia_id, "org": org_id},
    )
    doc_id = str(uuid.uuid4())
    codigo_validacion = str(uuid.uuid4())
    folio = f"FOL-{uuid.uuid4().hex[:8].upper()}"
    await db.execute(
        text("""
            INSERT INTO aaces.documentos_emitidos (id, organizacion_id, tipo_documento, codigo_validacion, folio, storage_provider, storage_key, pdf_hash, emitido_por, fecha_emision, estatus)
            VALUES (:id, :org_id, :tipo, :codigo, :folio, 'local', :key, '', NULL, now(), 'emitido')
        """),
        {"id": doc_id, "org_id": org_id, "tipo": row[1], "codigo": codigo_validacion,
         "folio": folio, "key": f"constancias/{doc_id}.pdf"},
    )
    return {"id": doc_id, "codigo_validacion": codigo_validacion, "estatus": "emitido", "folio": folio}
