"""Plantillas con el formato propio del cliente (PDF/imagen) y generación masiva
de DC-3/constancias para los participantes de un curso."""
from __future__ import annotations

import hashlib
import json
import re
import unicodedata
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.identity import Identity, require_org_identity
from app.services import plantillas_pdf as P

router = APIRouter()

MAX_PARTICIPANTES = 300


class CamposIn(BaseModel):
    nombre: Optional[str] = None
    campos: Optional[List[Dict[str, Any]]] = None


class VistaPreviaIn(BaseModel):
    campos: Optional[List[Dict[str, Any]]] = None


class GenerarIn(BaseModel):
    curso_id: str
    curso_participante_ids: Optional[List[str]] = None
    confirmar_avisos: bool = False  # continuar pese a avisos de congruencia (queda registrado)
    formato: str = "pdf"  # pdf: un solo archivo para imprimir · zip: un PDF por participante


def _slug(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    return re.sub(r"[^A-Za-z0-9]+", "_", s).strip("_")[:60] or "documento"


def _archivo_participante(f: Dict[str, Any]) -> str:
    """DC3_Apellidos_Nombre_FOLIO, para el ZIP o la descarga de una sola persona."""
    apellidos = " ".join(x for x in (f.get("apellido_paterno"), f.get("apellido_materno")) if x) or (f.get("apellido") or "")
    base = _slug(" ".join(x for x in (apellidos, f.get("nombre")) if x)) or "participante"
    return f"DC3_{base}_{f.get('id_certificado') or f.get('codigo_validacion') or ''}".rstrip("_")


def _uuid(v: str, nombre: str = "id") -> str:
    try:
        return str(uuid.UUID(str(v)))
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail=f"{nombre} inválido")


async def _plantilla(db: AsyncSession, plantilla_id: str, org_id: str, con_archivo: bool = False) -> Dict[str, Any]:
    cols = "id, nombre, archivo_nombre, paginas, campos, fecha_creacion, fecha_actualizacion" + (", archivo" if con_archivo else "")
    row = (await db.execute(
        text(f"SELECT {cols} FROM aaces.plantillas_pdf WHERE id = :id AND organizacion_id = :org AND activa = true"),
        {"id": _uuid(plantilla_id, "Plantilla"), "org": org_id},
    )).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")
    return dict(row)


def _salida(p: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": str(p["id"]),
        "nombre": p["nombre"],
        "archivo_nombre": p.get("archivo_nombre"),
        "paginas": p.get("paginas") or [],
        "campos": p.get("campos") or [],
        "fecha_creacion": p["fecha_creacion"].isoformat() if p.get("fecha_creacion") else None,
        "fecha_actualizacion": p["fecha_actualizacion"].isoformat() if p.get("fecha_actualizacion") else None,
    }


# ---------------------------------------------------------------------------

@router.get("/campos")
async def catalogo_campos():
    return [{"clave": k, "etiqueta": e, "grupo": g} for k, (e, g, _) in P.CAMPOS.items()]


@router.get("")
async def listar(identity: Identity = Depends(require_org_identity), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        text("""
            SELECT id, nombre, archivo_nombre, paginas, campos, fecha_creacion, fecha_actualizacion
            FROM aaces.plantillas_pdf
            WHERE organizacion_id = :org AND activa = true
            ORDER BY fecha_actualizacion DESC NULLS LAST
        """),
        {"org": identity.org_id},
    )).mappings().all()
    return [_salida(dict(r)) for r in rows]


@router.post("", status_code=201)
async def crear(
    archivo: UploadFile = File(...),
    nombre: str = Form(...),
    identity: Identity = Depends(require_org_identity),
    db: AsyncSession = Depends(get_db),
):
    nombre = (nombre or "").strip()[:200]
    if not nombre:
        raise HTTPException(status_code=400, detail="Escribe un nombre para la plantilla")
    contenido = await archivo.read(P.MAX_BYTES + 1)
    try:
        pdf, paginas = P.normalizar_archivo(contenido, archivo.filename or "")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    row = (await db.execute(
        text("""
            INSERT INTO aaces.plantillas_pdf (organizacion_id, nombre, archivo, archivo_nombre, paginas)
            VALUES (:org, :nombre, :archivo, :archivo_nombre, CAST(:paginas AS JSONB))
            RETURNING id, nombre, archivo_nombre, paginas, campos, fecha_creacion, fecha_actualizacion
        """),
        {"org": identity.org_id, "nombre": nombre, "archivo": pdf,
         "archivo_nombre": (archivo.filename or "")[:255], "paginas": json.dumps(paginas)},
    )).mappings().first()
    await db.commit()
    return _salida(dict(row))


@router.get("/{plantilla_id}")
async def obtener(plantilla_id: str, identity: Identity = Depends(require_org_identity), db: AsyncSession = Depends(get_db)):
    return _salida(await _plantilla(db, plantilla_id, identity.org_id))


@router.get("/{plantilla_id}/archivo")
async def archivo(plantilla_id: str, identity: Identity = Depends(require_org_identity), db: AsyncSession = Depends(get_db)):
    p = await _plantilla(db, plantilla_id, identity.org_id, con_archivo=True)
    return Response(content=bytes(p["archivo"]), media_type="application/pdf",
                    headers={"Cache-Control": "private, max-age=300"})


@router.put("/{plantilla_id}")
async def actualizar(plantilla_id: str, body: CamposIn, identity: Identity = Depends(require_org_identity), db: AsyncSession = Depends(get_db)):
    await _plantilla(db, plantilla_id, identity.org_id)
    sets, params = [], {"id": plantilla_id, "org": identity.org_id}
    if body.nombre is not None:
        if not body.nombre.strip():
            raise HTTPException(status_code=400, detail="El nombre no puede quedar vacío")
        sets.append("nombre = :nombre"); params["nombre"] = body.nombre.strip()[:200]
    if body.campos is not None:
        sets.append("campos = CAST(:campos AS JSONB)"); params["campos"] = json.dumps(P.limpiar_campos(body.campos))
    if sets:
        await db.execute(
            text(f"UPDATE aaces.plantillas_pdf SET {', '.join(sets)}, fecha_actualizacion = now() WHERE id = :id AND organizacion_id = :org"),
            params,
        )
        await db.commit()
    return _salida(await _plantilla(db, plantilla_id, identity.org_id))


@router.delete("/{plantilla_id}", status_code=204)
async def eliminar(plantilla_id: str, identity: Identity = Depends(require_org_identity), db: AsyncSession = Depends(get_db)):
    await _plantilla(db, plantilla_id, identity.org_id)
    # Baja lógica: los DC-3 ya emitidos con esta plantilla se pueden volver a descargar
    await db.execute(
        text("UPDATE aaces.plantillas_pdf SET activa = false, fecha_actualizacion = now() WHERE id = :id AND organizacion_id = :org"),
        {"id": plantilla_id, "org": identity.org_id},
    )
    await db.commit()
    return Response(status_code=204)


@router.post("/{plantilla_id}/vista-previa")
async def vista_previa(plantilla_id: str, body: VistaPreviaIn, identity: Identity = Depends(require_org_identity), db: AsyncSession = Depends(get_db)):
    p = await _plantilla(db, plantilla_id, identity.org_id, con_archivo=True)
    campos = P.limpiar_campos(body.campos) if body.campos is not None else (p["campos"] or [])
    pdf = P.generar(bytes(p["archivo"]), campos, [P.valores_ejemplo(settings.PUBLIC_VERIFICATION_URL)])
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": 'inline; filename="vista_previa.pdf"'})


# ---------------------------------------------------------------------------
# Generación
# ---------------------------------------------------------------------------

_SQL_PARTICIPANTES = """
    SELECT cp.id AS cp_id, cp.codigo_validacion, cp.id_certificado, cp.estado_acreditacion,
           cp.fecha_emision_certificado AS fecha_emision,
           p.nombre, p.apellido, p.apellido_paterno, p.apellido_materno, p.curp, p.ocupacion, p.cargo, p.empresa,
           c.id AS curso_id, c.nombre AS curso_nombre, c.duracion_horas, c.fecha_inicio, c.fecha_fin, c.ciudad,
           c.empresa_contratante,
           COALESCE(o.nombre_comercial, o.razon_social, cl.nombre) AS capacitador,
           CASE WHEN o.stps_validado THEN o.stps_registro END AS registro_stps,
           COALESCE(cp.congruencia->>'instructor', ins.nombre) AS instructor,  -- el de cuando se dio el folio
           fi.firma AS firma_instructor
    FROM aaces.curso_participante cp
    JOIN aaces.participantes p ON p.id = cp.participante_id
    JOIN aaces.cursos c ON c.id = cp.curso_id
    LEFT JOIN aaces.instructores ins ON ins.id = c.instructor_id
    -- Firma de quien impartió el curso cuando se dio el folio (o el instructor actual del grupo)
    LEFT JOIN aaces.instructores fi ON fi.id = COALESCE(CAST(cp.congruencia->>'instructor_id' AS uuid), c.instructor_id)
    JOIN aaces.clientes cl ON cl.id = c.cliente_id
    JOIN aaces.organizaciones o ON o.id = cl.organizacion_id
    WHERE cl.organizacion_id = :org
"""


async def _asegurar_folios(db: AsyncSession, filas: List[Dict[str, Any]]) -> None:
    """Asigna código de validación, folio y fecha de emisión a quien no los tenga
    (mismo formato que la emisión existente) para que el QR sea verificable."""
    ahora = datetime.utcnow()
    for f in filas:
        cambios = {}
        if not f.get("codigo_validacion"):
            cambios["codigo_validacion"] = uuid.uuid4().hex[:8].upper()
        if not f.get("id_certificado"):
            cambios["id_certificado"] = f"CERT-{uuid.uuid4().hex[:8].upper()}"
        if not f.get("fecha_emision"):
            cambios["fecha_emision_certificado"] = ahora
        if cambios:
            sets = ", ".join(f"{k} = :{k}" for k in cambios)
            await db.execute(text(f"UPDATE aaces.curso_participante SET {sets} WHERE id = :id"), {**cambios, "id": f["cp_id"]})
            f.update({k if k != "fecha_emision_certificado" else "fecha_emision": v for k, v in cambios.items()})


async def _registrar_emision(db: AsyncSession, org_id: str, plantilla_id: str, f: Dict[str, Any], pdf: bytes, emitido_por: Optional[str]) -> None:
    """Registra el DC-3 en documentos_emitidos (una vez por código). El PDF no se
    guarda en disco: se regenera al descargarlo (storage_provider = 'plantilla_pdf')."""
    existe = (await db.execute(
        text("SELECT 1 FROM aaces.documentos_emitidos WHERE codigo_validacion = :c AND tipo_documento = 'CONSTANCIA' AND estatus = 'emitido' LIMIT 1"),
        {"c": f["codigo_validacion"]},
    )).first()
    if existe:
        return
    await db.execute(
        text("""
            INSERT INTO aaces.documentos_emitidos
                (id, organizacion_id, template_id, template_version, tipo_documento, codigo_validacion, folio,
                 storage_provider, storage_key, pdf_hash, documento_metadata, emitido_por, estatus)
            VALUES (:id, :org, NULL, 1, 'CONSTANCIA', :codigo, :folio, 'plantilla_pdf', :skey, :hash,
                    CAST(:meta AS JSONB), :por, 'emitido')
        """),
        {
            "id": str(uuid.uuid4()), "org": org_id, "codigo": f["codigo_validacion"], "folio": f["id_certificado"],
            "skey": f"{plantilla_id}/{f['cp_id']}", "hash": hashlib.sha256(pdf).hexdigest(),
            "meta": json.dumps({"curso_participante_id": str(f["cp_id"]), "curso_id": str(f["curso_id"]), "plantilla_pdf_id": plantilla_id}),
            "por": emitido_por,
        },
    )


@router.post("/{plantilla_id}/generar")
async def generar(plantilla_id: str, body: GenerarIn, identity: Identity = Depends(require_org_identity), db: AsyncSession = Depends(get_db)):
    p = await _plantilla(db, plantilla_id, identity.org_id, con_archivo=True)
    if not p["campos"]:
        raise HTTPException(status_code=400, detail="Coloca al menos un campo en la plantilla antes de generar")
    curso_id = _uuid(body.curso_id, "Curso")
    sql = _SQL_PARTICIPANTES + " AND c.id = :curso AND cp.estado_acreditacion = true"
    params: Dict[str, Any] = {"org": identity.org_id, "curso": curso_id}
    if body.curso_participante_ids:
        ids = [_uuid(x, "Participante") for x in body.curso_participante_ids][:MAX_PARTICIPANTES]
        sql += " AND cp.id = ANY(CAST(:ids AS uuid[]))"
        params["ids"] = ids
    sql += " ORDER BY p.apellido_paterno NULLS LAST, p.nombre"
    filas = [dict(r) for r in (await db.execute(text(sql), params)).mappings().all()]
    if not filas:
        raise HTTPException(status_code=400, detail="No hay participantes acreditados para generar. Acredítalos primero en la agenda del curso.")
    if len(filas) > MAX_PARTICIPANTES:
        raise HTTPException(status_code=400, detail=f"Máximo {MAX_PARTICIPANTES} participantes por archivo")

    # Límite del plan: solo cuentan quienes reciben su constancia por primera vez
    from app.services import cupo
    nuevos = await cupo.nuevos_de(db, [f["cp_id"] for f in filas])
    if nuevos:
        # Folios nuevos: revisar congruencia agente–curso–instructor (avisa, no bloquea)
        from app.services.congruencia import exigir_confirmacion
        await exigir_confirmacion(db, curso_id, "generar_dc3", body.confirmar_avisos,
                                  identity.user_id if identity.source == "usuario" else None)
    await cupo.verificar(db, identity.org_id, nuevos)
    await _asegurar_folios(db, filas)
    plantilla_pdf = bytes(p["archivo"])
    url = settings.PUBLIC_VERIFICATION_URL
    valores = [P.valores_participante(f, url) for f in filas]
    individuales = []
    for f, v in zip(filas, valores):
        individual = P.generar(plantilla_pdf, p["campos"], [v])
        individuales.append((f, individual))
        await _registrar_emision(db, identity.org_id, str(p["id"]), f, individual, identity.user_id if identity.source == "usuario" else None)
    await db.commit()
    cupo.avisar_en_segundo_plano(identity.org_id)

    if body.formato == "zip":
        # Un PDF por participante, nombrado por apellido y folio para enviarlo a cada empresa
        import io, zipfile
        buf, usados = io.BytesIO(), set()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
            for f, individual in individuales:
                nombre_pdf = _archivo_participante(f)
                while nombre_pdf in usados:
                    nombre_pdf += "_2"
                usados.add(nombre_pdf)
                z.writestr(f"{nombre_pdf}.pdf", individual)
        return Response(
            content=buf.getvalue(), media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="DC3_{_slug(filas[0]["curso_nombre"])}.zip"', "X-Generados": str(len(filas)),
                     "Access-Control-Expose-Headers": "X-Generados, Content-Disposition"},
        )

    pdf = P.generar(plantilla_pdf, p["campos"], valores)
    # Un solo participante (p. ej. reimprimir el que faltó): se nombra por él, no por el curso
    nombre = f"{_archivo_participante(filas[0])}.pdf" if len(filas) == 1 else f"DC3_{_slug(filas[0]['curso_nombre'])}.pdf"
    return Response(
        content=pdf, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{nombre}"', "X-Generados": str(len(filas)),
                 "Access-Control-Expose-Headers": "X-Generados, Content-Disposition"},
    )


async def regenerar_documento(db: AsyncSession, storage_key: str, org_id: Optional[str]) -> Optional[bytes]:
    """Vuelve a generar un DC-3 emitido con plantilla (storage_provider = 'plantilla_pdf')."""
    try:
        plantilla_id, cp_id = storage_key.split("/", 1)
        uuid.UUID(plantilla_id); uuid.UUID(cp_id)
    except (ValueError, AttributeError):
        return None
    filtro = "AND organizacion_id = :org" if org_id else ""
    prm: Dict[str, Any] = {"id": plantilla_id}
    if org_id:
        prm["org"] = org_id
    pl = (await db.execute(text(f"SELECT archivo, campos, organizacion_id FROM aaces.plantillas_pdf WHERE id = :id {filtro}"), prm)).mappings().first()
    if not pl:
        return None
    fila = (await db.execute(text(_SQL_PARTICIPANTES + " AND cp.id = :cp"), {"org": str(pl["organizacion_id"]), "cp": cp_id})).mappings().first()
    if not fila:
        return None
    return P.generar(bytes(pl["archivo"]), pl["campos"] or [], [P.valores_participante(dict(fila), settings.PUBLIC_VERIFICATION_URL)])
