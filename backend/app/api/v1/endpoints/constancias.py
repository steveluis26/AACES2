import logging
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from datetime import date
import uuid

from app.core.database import get_db
from app.api.v1.endpoints.auth import require_org_admin, get_current_user_data
from app.services.constancias import constancias_service
from app.schemas import (
    EmitirConstanciaRequest, ConstanciaDetalleResponse,
    ConstanciaListResponse,
    ConstanciaResumenResponse,
)
from app.queries.constancia_list import ConstanciaListQuery
from app.services.constancia_detalle import constancia_detalle_service
from app.core.enums import ConstanciaSort, OrderEnum
from app.core.logging import audit_logger

logger = logging.getLogger(__name__)
router = APIRouter()


from pydantic import BaseModel, Field


class EmitirConstanciaLegacyRequest(BaseModel):
    curso_participante_id: str
    tipo_documento: str = Field(default="CONSTANCIA", pattern="^(CONSTANCIA|DC3|DIPLOMA|CREDENCIAL|OTRO)$")


@router.post("", status_code=status.HTTP_201_CREATED)
async def emitir_constancia_legacy(
    payload: EmitirConstanciaLegacyRequest,
    user_data: dict = Depends(get_current_user_data),
    db: AsyncSession = Depends(get_db),
):
    cid = user_data.get("sub")
    if not cid:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")

    await db.execute(text("SET LOCAL search_path TO aaces"))

    cp = await db.execute(
        text("""
            SELECT cp.id, cp.curso_id, cp.participante_id, c.cliente_id
            FROM aaces.curso_participante cp
            JOIN aaces.cursos c ON c.id = cp.curso_id
            WHERE cp.id = :cp_id
            LIMIT 1
        """),
        {"cp_id": payload.curso_participante_id},
    )
    cp_row = cp.fetchone()
    if not cp_row:
        raise HTTPException(status_code=404, detail="Curso-participante no encontrado")
    if str(cp_row[3]) != cid:
        raise HTTPException(status_code=403, detail="No tienes permiso para emitir constancias de este curso")

    org_res = await db.execute(
        text("SELECT organizacion_id FROM aaces.clientes WHERE id = :cid"),
        {"cid": cid},
    )
    org_row = org_res.fetchone()
    org_id = str(org_row[0]) if org_row and org_row[0] else None
    if not org_id:
        org_res2 = await db.execute(
            text("SELECT id FROM aaces.organizaciones ORDER BY fecha_creacion LIMIT 1")
        )
        org_row2 = org_res2.fetchone()
        org_id = str(org_row2[0]) if org_row2 else None

    doc_id = str(uuid.uuid4())
    codigo_validacion = str(uuid.uuid4())
    folio = f"FOL-{uuid.uuid4().hex[:8].upper()}"
    await db.execute(
        text("""
            INSERT INTO aaces.documentos_emitidos (id, organizacion_id, tipo_documento, codigo_validacion, folio, storage_provider, storage_key, pdf_hash, emitido_por, fecha_emision, estatus)
            VALUES (:id, :org_id, :tipo, :codigo, :folio, 'local', :key, '', NULL, now(), 'emitido')
        """),
        {
            "id": doc_id, "org_id": org_id, "tipo": payload.tipo_documento,
            "codigo": codigo_validacion, "folio": folio,
            "key": f"constancias/{doc_id}.pdf",
        },
    )

    cp_id = payload.curso_participante_id
    await db.execute(
        text("UPDATE aaces.curso_participante SET codigo_validacion = :cv, fecha_emision_certificado = now() WHERE id = :cp_id"),
        {"cv": codigo_validacion, "cp_id": cp_id},
    )

    await db.commit()
    return {"id": doc_id, "codigo_validacion": codigo_validacion, "folio": folio}


@router.post("/emitir")
async def emitir_constancia(
    payload: EmitirConstanciaRequest,
    user_data: dict = Depends(get_current_user_data),
    db: AsyncSession = Depends(get_db),
):
    organizacion_id = user_data.get("org_id")
    if not organizacion_id:
        cid = user_data.get("sub")
        if cid:
            row = await db.execute(
                text("SELECT organizacion_id FROM aaces.clientes WHERE id=:cid"),
                {"cid": cid},
            )
            r = row.fetchone()
            organizacion_id = str(r[0]) if r and r[0] else None
    if not organizacion_id:
        raise HTTPException(status_code=403, detail="Se requiere una organización asociada")
    try:
        doc = await constancias_service.emitir(
            db=db,
            organizacion_id=organizacion_id,
            curso_participante_id=payload.curso_participante_id,
            emitido_por=user_data.get("sub"),
            template_id=payload.template_id,
        )
        audit_logger.log_user_action(
            user_id=user_data.get("sub"),
            action="constancia_emitida",
            resource="constancias",
            details={"doc_id": doc["id"], "codigo_validacion": doc["codigo_validacion"]},
        )
        return {"success": True, "documento": doc}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception(f"Error emitiendo constancia: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al emitir constancia")


@router.get("")
async def listar_constancias(
    q: Optional[str] = Query(None, max_length=100),
    estado: Optional[str] = Query(None),
    curso_id: Optional[str] = Query(None),
    folio: Optional[str] = Query(None),
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    user_data: dict = Depends(get_current_user_data),
    db: AsyncSession = Depends(get_db),
):
    cid = user_data.get("sub")
    if not cid:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")

    await db.execute(text("SET LOCAL search_path TO aaces"))

    conditions = []
    params: Dict[str, Any] = {}

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

    where_clause = " AND ".join(conditions) if conditions else "TRUE"

    # Conteo total
    count_res = await db.execute(
        text(f"SELECT count(*) FROM aaces.documentos_emitidos d WHERE {where_clause}"),
        params,
    )
    total = int(count_res.scalar() or 0)
    total_pages = max(1, (total + page_size - 1) // page_size)

    offset = (page - 1) * page_size
    # JOIN para traer nombre de participante y curso, y conteo de verificaciones
    res = await db.execute(
        text(f"""
            SELECT
                d.id,
                d.tipo_documento,
                d.estatus,
                d.codigo_validacion,
                d.folio,
                d.fecha_emision,
                COALESCE(p.nombre || ' ' || p.apellido, '') AS participante_nombre,
                COALESCE(c.nombre, '') AS curso_nombre,
                COALESCE(v.cnt, 0) AS verificaciones_count
            FROM aaces.documentos_emitidos d
            LEFT JOIN aaces.curso_participante cp
                ON cp.codigo_validacion::text = d.codigo_validacion::text
            LEFT JOIN aaces.participantes p
                ON p.id = cp.participante_id
            LEFT JOIN aaces.cursos c
                ON c.id = cp.curso_id
            LEFT JOIN (
                SELECT codigo_validacion, count(*) AS cnt
                FROM aaces.validaciones_publicas
                GROUP BY codigo_validacion
            ) v ON v.codigo_validacion::text = d.codigo_validacion::text
            WHERE {where_clause}
            ORDER BY d.fecha_emision DESC
            LIMIT :limit OFFSET :offset
        """),
        {**params, "limit": page_size, "offset": offset},
    )
    rows = res.fetchall()

    items = [
        {
            "id": str(r[0]),
            "tipo_documento": r[1],
            "estatus": r[2],
            "codigo_validacion": str(r[3]),
            "folio": r[4],
            "fecha_emision": r[5].isoformat() if r[5] else None,
            "participante_nombre": (r[6] or "").strip(),
            "curso_nombre": r[7] or "",
            "verificaciones_count": int(r[8] or 0),
        }
        for r in rows
    ]

    return {
        "items": items,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": total_pages,
        },
        "meta": {
            "filters_applied": len(conditions),
            "query_time_ms": 0,
        },
    }


@router.get("/resumen")
async def resumen_constancias(
    user_data: dict = Depends(get_current_user_data),
    db: AsyncSession = Depends(get_db),
):
    cid = user_data.get("sub")
    if not cid:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")

    await db.execute(text("SET LOCAL search_path TO aaces"))

    total = await db.execute(text("SELECT count(*) FROM aaces.documentos_emitidos"))
    emitidas = await db.execute(text("SELECT count(*) FROM aaces.documentos_emitidos WHERE estatus = 'emitido'"))
    canceladas = await db.execute(text("SELECT count(*) FROM aaces.documentos_emitidos WHERE estatus = 'cancelado'"))

    return {
        "total": int(total.scalar() or 0),
        "emitidas": int(emitidas.scalar() or 0),
        "canceladas": int(canceladas.scalar() or 0),
    }


@router.get("/{constancia_id}")
async def detalle_constancia(
    constancia_id: str,
    user_data: dict = Depends(get_current_user_data),
    db: AsyncSession = Depends(get_db),
):
    cid = user_data.get("sub")
    if not cid:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")

    await db.execute(text("SET LOCAL search_path TO aaces"))

    res = await db.execute(
        text("""
            SELECT id, tipo_documento, estatus, codigo_validacion, folio, fecha_emision, storage_key
            FROM aaces.documentos_emitidos
            WHERE id = :id
            LIMIT 1
        """),
        {"id": constancia_id},
    )
    row = res.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Constancia no encontrada")

    pdf_url = f"/constancias/{constancia_id}/pdf"

    return {
        "id": str(row[0]),
        "tipo_documento": row[1],
        "estatus": row[2],
        "codigo_validacion": str(row[3]),
        "folio": row[4],
        "fecha_emision": row[5].isoformat() if row[5] else None,
        "pdf_url": pdf_url,
        "storage_key": row[6],
    }


@router.get("/{constancia_id}/pdf")
async def descargar_pdf_constancia(
    constancia_id: str,
    user_data: dict = Depends(get_current_user_data),
    db: AsyncSession = Depends(get_db),
):
    cid = user_data.get("sub")
    if not cid:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")

    await db.execute(text("SET LOCAL search_path TO aaces"))
    res = await db.execute(
        text("SELECT storage_key FROM aaces.documentos_emitidos WHERE id = :id LIMIT 1"),
        {"id": constancia_id},
    )
    row = res.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Constancia no encontrada")

    minimal_pdf = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF"

    filename = row[0] or f"constancia-{constancia_id}.pdf"
    return Response(
        content=minimal_pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.post("/{constancia_id}/cancelar")
async def cancelar_constancia(
    constancia_id: str,
    user_data: dict = Depends(get_current_user_data),
    db: AsyncSession = Depends(get_db),
):
    cid = user_data.get("sub")
    if not cid:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")

    await db.execute(text("SET LOCAL search_path TO aaces"))
    res = await db.execute(
        text("SELECT estatus FROM aaces.documentos_emitidos WHERE id = :id LIMIT 1"),
        {"id": constancia_id},
    )
    row = res.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Constancia no encontrada")
    if row[0] == "cancelado":
        raise HTTPException(status_code=400, detail="La constancia ya está cancelada")

    await db.execute(
        text("UPDATE aaces.documentos_emitidos SET estatus = 'cancelado' WHERE id = :id"),
        {"id": constancia_id},
    )
    await db.commit()
    return {"status": "cancelado"}


@router.post("/{constancia_id}/reemitir")
async def reemitir_constancia(
    constancia_id: str,
    user_data: dict = Depends(get_current_user_data),
    db: AsyncSession = Depends(get_db),
):
    cid = user_data.get("sub")
    if not cid:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")

    await db.execute(text("SET LOCAL search_path TO aaces"))
    res = await db.execute(
        text("SELECT organizacion_id, tipo_documento FROM aaces.documentos_emitidos WHERE id = :id LIMIT 1"),
        {"id": constancia_id},
    )
    row = res.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Constancia no encontrada")

    org_id = str(row[0]) if row[0] else None
    tipo_doc = row[1]

    await db.execute(
        text("UPDATE aaces.documentos_emitidos SET estatus = 'reemitido' WHERE id = :id"),
        {"id": constancia_id},
    )

    doc_id = str(uuid.uuid4())
    codigo_validacion = str(uuid.uuid4())
    folio = f"FOL-{uuid.uuid4().hex[:8].upper()}"
    await db.execute(
        text("""
            INSERT INTO aaces.documentos_emitidos (id, organizacion_id, tipo_documento, codigo_validacion, folio, storage_provider, storage_key, pdf_hash, emitido_por, fecha_emision, estatus)
            VALUES (:id, :org_id, :tipo, :codigo, :folio, 'local', :key, '', NULL, now(), 'emitido')
        """),
        {
            "id": doc_id, "org_id": org_id, "tipo": tipo_doc,
            "codigo": codigo_validacion, "folio": folio,
            "key": f"constancias/{doc_id}.pdf",
        },
    )
    await db.commit()
    return {"id": doc_id, "codigo_validacion": codigo_validacion, "estatus": "emitido", "folio": folio}


@router.get("/{constancia_id}/timeline")
async def timeline_constancia(
    constancia_id: str,
    user_data: dict = Depends(get_current_user_data),
    db: AsyncSession = Depends(get_db),
):
    cid = user_data.get("sub")
    if not cid:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")

    await db.execute(text("SET LOCAL search_path TO aaces"))
    res = await db.execute(
        text("SELECT estatus, fecha_emision FROM aaces.documentos_emitidos WHERE id = :id LIMIT 1"),
        {"id": constancia_id},
    )
    row = res.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Constancia no encontrada")

    eventos = [
        {"tipo": "emitido", "fecha": row[1].isoformat() if row[1] else None},
    ]
    est = row[0]
    if est == "cancelado":
        eventos.append({"tipo": "cancelado", "fecha": None})
    elif est == "reemitido":
        eventos.append({"tipo": "cancelado", "fecha": None})
        eventos.append({"tipo": "reemitido", "fecha": None})

    return {"eventos": eventos}
