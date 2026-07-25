import uuid
import json
import logging
import time
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError
from app.db.errors import is_undefined_table
from datetime import datetime, date
from dateutil.relativedelta import relativedelta

from app.services.document_service import DocumentService
from app.services.storage_provider import LocalStorageProvider, StorageProvider
from app.core.config import settings
from app.schemas.capabilities import DocumentCapabilities
from app.core.enums import ConstanciaSort, OrderEnum
from app.queries.constancia_list import ConstanciaListQuery
from app.schemas import (
    ConstanciaResumen, PaginationInfo,
    ConstanciaListMeta, ConstanciaListResponse, ConstanciaResumenResponse,
)

logger = logging.getLogger(__name__)


def _get_storage() -> StorageProvider:
    provider = settings.STORAGE_PROVIDER
    if provider == "local":
        return LocalStorageProvider(base_dir=settings.STORAGE_DIR)
    return LocalStorageProvider(base_dir=settings.STORAGE_DIR)


class ConstanciasService:

    def __init__(self):
        self._storage = _get_storage()
        self._doc_service = DocumentService(storage_provider=self._storage)

    async def emitir(
        self,
        db: AsyncSession,
        organizacion_id: str,
        curso_participante_id: str,
        emitido_por: Optional[str] = None,
        template_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        cp_row = await db.execute(
            text("""
                SELECT cp.id, cp.codigo_validacion, cp.curso_id, cp.participante_id, cp.estado_acreditacion,
                       cp.calificacion, cp.asistencia,
                       cp.fecha_inicio_vigencia, cp.fecha_expiracion,
                       c.nombre as curso_nombre,
                       c.fecha_inicio, c.fecha_fin, c.duracion_horas, c.duracion_validacion,
                       c.cliente_id, c.organizacion_id,
                       p.nombre as part_nombre, p.apellido as part_apellido,
                       p.correo as part_correo, p.empresa as part_empresa
                FROM aaces.curso_participante cp
                JOIN aaces.cursos c ON c.id = cp.curso_id
                JOIN aaces.organizaciones cl ON cl.id = c.organizacion_id
                JOIN aaces.participantes p ON p.id = cp.participante_id
                WHERE cp.id = :cp_id
                LIMIT 1
            """),
            {"cp_id": curso_participante_id}
        )
        cp = cp_row.fetchone()
        if not cp:
            raise ValueError("Curso-participante no encontrado")

        if str(cp.organizacion_id) != organizacion_id:
            raise ValueError("El curso no pertenece a tu organización")

        if not cp.estado_acreditacion:
            raise ValueError("El participante no está acreditado en este curso")

        now = datetime.utcnow()
        participante_nombre = f"{cp.part_nombre or ''} {cp.part_apellido or ''}".strip()

        # Idempotencia: si ya existe una constancia EMITIDA para este
        # curso_participante, regresarla sin crear otra fila (nunca dos).
        existente = await db.execute(
            text("""
                SELECT id, codigo_validacion FROM aaces.documentos_emitidos
                WHERE curso_participante_id = :cp_id AND estatus = 'emitido'
                ORDER BY fecha_emision DESC LIMIT 1
            """),
            {"cp_id": curso_participante_id},
        )
        ex_row = existente.fetchone()
        if ex_row:
            doc_id_existente = str(ex_row[0])
            cv_existente = str(ex_row[1])
            # Asegurar que el curso_participante tenga su codigo_validacion poblado.
            await db.execute(
                text("UPDATE aaces.curso_participante SET codigo_validacion = :cv WHERE id = :cp_id AND codigo_validacion IS NULL"),
                {"cv": cv_existente, "cp_id": curso_participante_id},
            )
            await db.commit()
            storage_url = await self._storage.url(
                f"{organizacion_id}/CONSTANCIA/{cv_existente}.pdf"
            )
            return {
                "id": doc_id_existente,
                "codigo_validacion": cv_existente,
                "pdf_hash": None,
                "descarga_url": storage_url,
                "participante_nombre": participante_nombre,
                "curso_nombre": cp.curso_nombre,
                "fecha_emision": now.isoformat(),
                "idempotente": True,
            }

        # Reusar el codigo de validacion ya emitido (si existe) para no regenerarlo
        # en cada re-emision. validaciones_publicas es FK a curso_participante.codigo_validacion,
        # asi que cambiarlo romperia las validaciones previas del mismo participante.
        codigo_validacion = cp.codigo_validacion if cp.codigo_validacion else str(uuid.uuid4())

        fecha_inicio_str = cp.fecha_inicio.isoformat() if cp.fecha_inicio else ""
        fecha_fin_str = cp.fecha_fin.isoformat() if cp.fecha_fin else ""

        data = {
            "participante_nombre": participante_nombre,
            "participante_apellido": cp.part_apellido or "",
            "participante_correo": cp.part_correo or "",
            "curso_nombre": cp.curso_nombre or "",
            "curso_fecha_inicio": fecha_inicio_str,
            "curso_fecha_fin": fecha_fin_str,
            "curso_duracion_horas": cp.duracion_horas or 0,
            "calificacion": float(cp.calificacion) if cp.calificacion else 0,
            "asistencia": float(cp.asistencia) if cp.asistencia else 0,
            "codigo_validacion": codigo_validacion,
            "fecha_emision": now.isoformat(),
            "fecha_inicio_vigencia": cp.fecha_inicio_vigencia.isoformat() if cp.fecha_inicio_vigencia else "",
            "fecha_expiracion": cp.fecha_expiracion.isoformat() if cp.fecha_expiracion else "",
            "participante_empresa": (cp.part_empresa or cp.curso_empresa_contratante or ""),
        }

        # A2.3: derivar vigencia automática desde duracion_validacion del curso
        if cp.fecha_inicio_vigencia and cp.fecha_expiracion:
            inicio_vig = cp.fecha_inicio_vigencia
            fin_vig = cp.fecha_expiracion
        else:
            meses = int(cp.duracion_validacion) if cp.duracion_validacion else 12
            inicio_vig = now
            fin_vig = now + relativedelta(months=meses)
            # persistir en curso_participante para renovaciones
            await db.execute(
                text("UPDATE aaces.curso_participante SET fecha_inicio_vigencia = :iv, fecha_expiracion = :fv WHERE id = :cp_id"),
                {"iv": inicio_vig, "fv": fin_vig, "cp_id": curso_participante_id},
            )

        # Folio secuencial por organización (A2.3)
        folio_row = await db.execute(
            text("SELECT count(*) + 1 FROM aaces.documentos_emitidos WHERE organizacion_id = :org AND estatus = 'emitido'"),
            {"org": organizacion_id},
        )
        n_folio = folio_row.scalar() or 1
        folio = f"AAC-{now.year}-{n_folio:05d}"
        data["folio"] = folio

        if template_id:
            tpl = await db.execute(
                text("""
                    SELECT id, version, html_template, recursos, config
                    FROM aaces.templates
                    WHERE id = :id AND organizacion_id = :org_id AND activa = true AND tipo_documento = 'CONSTANCIA'
                    LIMIT 1
                """),
                {"id": template_id, "org_id": organizacion_id}
            )
            t = tpl.fetchone()
            if not t:
                raise ValueError("Plantilla de constancia no encontrada o inactiva")
        else:
            tpl = await db.execute(
                text("""
                    SELECT id, version, html_template, recursos, config
                    FROM aaces.templates
                    WHERE organizacion_id = :org_id AND activa = true AND tipo_documento = 'CONSTANCIA'
                    ORDER BY fecha_creacion DESC
                    LIMIT 1
                """),
                {"org_id": organizacion_id}
            )
            t = tpl.fetchone()
            if not t:
                raise ValueError(
                    "No tienes una plantilla de constancia activa. Crea una en Plantillas antes de emitir."
                )

        t_id, t_version, html, recursos, config = t

        qr_data = f"{settings.PUBLIC_VERIFICATION_URL}/{codigo_validacion}"

        result = await self._doc_service.generate(
            html_template=html,
            data=data,
            qr_data=qr_data,
            recursos=recursos,
            config=config,
            storage_key=f"{organizacion_id}/CONSTANCIA/{codigo_validacion}.pdf",
        )

        doc_id = str(uuid.uuid4())
        metadata_val = json.dumps({
            "curso_participante_id": curso_participante_id,
            "curso_id": str(cp.curso_id),
            "participante_id": str(cp.participante_id),
        })

        await db.execute(
            text(""" 
                INSERT INTO aaces.documentos_emitidos
                    (id, organizacion_id, template_id, template_version, tipo_documento,
                     codigo_validacion, folio, storage_provider, storage_key, pdf_hash,
                     html_snapshot, documento_metadata, emitido_por, estatus, curso_participante_id)
                VALUES
                    (:id, :org_id, :template_id, :version, 'CONSTANCIA',
                     :codigo, :folio, :provider, :skey, :hash,
                     :snapshot, :meta, :emitido_por, 'emitido', :cp_id)
            """),
            {
                "id": doc_id, "org_id": organizacion_id,
                "template_id": t_id, "version": t_version,
                "codigo": codigo_validacion,
                "folio": folio,
                "provider": result.storage_provider,
                "skey": result.storage_key,
                "hash": result.pdf_hash,
                "snapshot": result.html_snapshot,
                "meta": metadata_val,
                "emitido_por": emitido_por,
                "cp_id": curso_participante_id,
            }
        )

        storage_url = await self._storage.url(result.storage_key)
        await db.execute(
            text("""
                UPDATE aaces.curso_participante
                SET codigo_validacion = :codigo,
                    certificado_url = :url,
                    fecha_emision_certificado = :fecha_emision
                WHERE id = :cp_id
            """),
            {
                "codigo": codigo_validacion,
                "url": storage_url,
                "fecha_emision": now,
                "cp_id": curso_participante_id,
            }
        )
        # (La vigencia ya se derivó y persistió arriba; no sobrescribir con NULL)
        await db.commit()

        return {
            "id": doc_id,
            "codigo_validacion": codigo_validacion,
            "folio": folio,
            "pdf_hash": result.pdf_hash,
            "descarga_url": storage_url,
            "participante_nombre": participante_nombre,
            "curso_nombre": cp.curso_nombre,
            "fecha_emision": now.isoformat(),
            "idempotente": False,
        }

    def _build_filters(self, query: ConstanciaListQuery, organizacion_id: str):
        conditions = ["d.organizacion_id = :org_id", "d.tipo_documento = 'CONSTANCIA'"]
        params: Dict[str, Any] = {"org_id": organizacion_id}

        if query.estado:
            conditions.append("d.estatus = :estado")
            params["estado"] = query.estado

        if query.template_id:
            conditions.append("d.template_id = :template_id")
            params["template_id"] = query.template_id

        text_conditions = []
        has_text_search = False

        if query.q:
            val = query.q.strip()
            is_uuid = len(val) == 36 and val.count("-") == 4
            is_exact = is_uuid or (len(val) > 3 and val.isascii() and not any(c.isspace() for c in val))

            if is_exact:
                text_conditions.append("(d.codigo_validacion::text = :q_exact OR d.folio = :q_exact)")
                params["q_exact"] = val
            else:
                like_val = f"%{val}%"
                text_conditions.append(
                    "(p.nombre ILIKE :q OR p.apellido ILIKE :q "
                    "OR c.nombre ILIKE :q "
                    "OR COALESCE(p.empresa, '') ILIKE :q "
                    "OR d.codigo_validacion::text ILIKE :q_text "
                    "OR COALESCE(d.folio, '') ILIKE :q)"
                )
                params["q"] = like_val
                params["q_text"] = f"%{val}%"
            has_text_search = True

        if query.curso_id:
            conditions.append("c.id = :curso_id")
            params["curso_id"] = query.curso_id

        if query.verificada is not None:
            if query.verificada:
                conditions.append("EXISTS (SELECT 1 FROM aaces.verificaciones v WHERE v.codigo = d.codigo_validacion::text AND v.resultado = 'VALIDA')")
            else:
                conditions.append("NOT EXISTS (SELECT 1 FROM aaces.verificaciones v WHERE v.codigo = d.codigo_validacion::text AND v.resultado = 'VALIDA')")

        if query.fecha_desde:
            conditions.append("d.fecha_emision >= :fecha_desde")
            params["fecha_desde"] = query.fecha_desde

        if query.fecha_hasta:
            conditions.append("d.fecha_emision <= :fecha_hasta")
            params["fecha_hasta"] = query.fecha_hasta

        if text_conditions:
            conditions.extend(text_conditions)

        return conditions, params, has_text_search

    def _order_clause(self, sort: ConstanciaSort, order: OrderEnum) -> str:
        sort_map = {
            ConstanciaSort.FECHA: "d.fecha_emision",
            ConstanciaSort.PARTICIPANTE: "participante_nombre",
            ConstanciaSort.CURSO: "curso_nombre",
            ConstanciaSort.ESTADO: "d.estatus",
        }
        col = sort_map.get(sort, "d.fecha_emision")
        direction = "DESC" if order == OrderEnum.DESC else "ASC"
        return f"{col} {direction}, d.id DESC"

    async def listar(
        self,
        db: AsyncSession,
        organizacion_id: str,
        query: ConstanciaListQuery,
    ) -> ConstanciaListResponse:
        start = time.time()
        conditions, params, has_text_search = self._build_filters(query, organizacion_id)
        where = " AND ".join(conditions)
        order_sql = self._order_clause(query.sort, query.order)

        join_clause = """
            FROM aaces.documentos_emitidos d
            LEFT JOIN aaces.curso_participante cp ON cp.codigo_validacion::text = d.codigo_validacion::text
            LEFT JOIN aaces.participantes p ON p.id = cp.participante_id
            LEFT JOIN aaces.cursos c ON c.id = cp.curso_id AND c.cliente_id IN (
                SELECT id FROM aaces.clientes WHERE organizacion_id = :org_id
            )
        """

        count_sql = f"SELECT COUNT(*) {join_clause} WHERE {where}"
        count_row = await db.execute(text(count_sql), params)
        total = count_row.scalar() or 0
        total_pages = max(1, (total + query.page_size - 1) // query.page_size)

        offset = (query.page - 1) * query.page_size
        params["limit"] = query.page_size
        params["offset"] = offset

        select_sql = f"""
            SELECT d.id, d.codigo_validacion, d.estatus, d.fecha_emision,
                   d.pdf_hash, d.folio,
                   (p.nombre || ' ' || COALESCE(p.apellido, '')) AS participante_nombre,
                   c.nombre AS curso_nombre,
                   (SELECT COUNT(*) FROM aaces.verificaciones v
                    WHERE v.codigo = d.codigo_validacion::text AND v.resultado = 'VALIDA') AS verificaciones_count
            {join_clause}
            WHERE {where}
            ORDER BY {order_sql}
            LIMIT :limit OFFSET :offset
        """

        rows = await db.execute(text(select_sql), params)

        items = []
        for r in rows.fetchall():
            estatus = r[2]
            items.append(ConstanciaResumen(
                id=r[0],
                codigo_validacion=str(r[1]),
                estatus=estatus,
                fecha_emision=r[3],
                pdf_hash=r[4],
                participante_nombre=(r[6] or "").strip(),
                curso_nombre=r[7] or "",
                folio=r[5],
                verificaciones_count=int(r[8] or 0),
                capabilities=DocumentCapabilities(
                    cancelar=estatus in ("emitido", "reemitido"),
                    reemitir=False,
                    descargar=estatus in ("emitido", "reemitido"),
                    compartir=estatus in ("emitido", "reemitido"),
                ),
            ))

        elapsed = (time.time() - start) * 1000

        return ConstanciaListResponse(
            items=items,
            pagination=PaginationInfo(
                page=query.page,
                page_size=query.page_size,
                total=total,
                total_pages=total_pages,
            ),
            meta=ConstanciaListMeta(
                filters_applied=len([v for v in [query.q, query.estado, query.curso_id, query.fecha_desde, query.fecha_hasta, query.verificada, query.template_id] if v is not None]),
                query_time_ms=round(elapsed, 1),
            ),
        )

    async def resumen(
        self,
        db: AsyncSession,
        organizacion_id: str,
    ) -> ConstanciaResumenResponse:
        try:
            row = await db.execute(
                text("""
                    SELECT
                        COUNT(*) AS total,
                        COUNT(*) FILTER (WHERE d.estatus = 'emitido') AS emitidas,
                        COUNT(*) FILTER (WHERE d.estatus = 'cancelado') AS canceladas,
                        COUNT(*) FILTER (WHERE d.estatus = 'reemitido') AS reemitidas
                    FROM aaces.documentos_emitidos d
                    WHERE d.organizacion_id = :org_id AND d.tipo_documento = 'CONSTANCIA'
                """),
                {"org_id": organizacion_id}
            )
            r = row.fetchone()
            total = int(r[0] or 0)
            emitidas = int(r[1] or 0)
            canceladas = int(r[2] or 0)
            reemitidas = int(r[3] or 0)

            verif = await db.execute(
                text("""
                    SELECT COUNT(DISTINCT v.codigo)
                    FROM aaces.verificaciones v
                    JOIN aaces.documentos_emitidos d ON d.codigo_validacion::text = v.codigo
                    WHERE d.organizacion_id = :org_id AND d.tipo_documento = 'CONSTANCIA'
                      AND v.resultado = 'VALIDA'
                """),
                {"org_id": organizacion_id}
            )
            verificadas = int(verif.scalar() or 0)

            acreditadas = await db.execute(
                text("""
                    SELECT COUNT(*) FROM aaces.curso_participante cp
                    JOIN aaces.cursos c ON c.id = cp.curso_id
                    JOIN aaces.organizaciones cl ON cl.id = c.organizacion_id
                    WHERE c.organizacion_id = :org_id
                      AND cp.estado_acreditacion = true
                """),
                {"org_id": organizacion_id}
            )
            total_acreditados = int(acreditadas.scalar() or 0)
            pendientes = total_acreditados - emitidas
            if pendientes < 0:
                pendientes = 0

            tiempo = await db.execute(
                text("""
                    SELECT AVG(
                        EXTRACT(EPOCH FROM (d.fecha_emision - cp.fecha_emision_certificado)) / 3600
                    )
                    FROM aaces.documentos_emitidos d
                    JOIN aaces.curso_participante cp ON cp.codigo_validacion::text = d.codigo_validacion::text
                    JOIN aaces.cursos c ON c.id = cp.curso_id
                    JOIN aaces.organizaciones cl ON cl.id = c.organizacion_id
                    WHERE c.organizacion_id = :org_id
                      AND d.tipo_documento = 'CONSTANCIA'
                      AND cp.fecha_emision_certificado IS NOT NULL
                """),
                {"org_id": organizacion_id}
            )
            promedio = tiempo.scalar()
        except ProgrammingError as e:
            if not is_undefined_table(e):
                raise
            logger.warning(f"Document engine tables not ready for org {organizacion_id}")
            return ConstanciaResumenResponse(
                total=0, emitidas=0, canceladas=0, reemitidas=0,
                verificadas=0, pendientes=0, tiempo_promedio_horas=None,
            )

        return ConstanciaResumenResponse(
            total=total,
            emitidas=emitidas,
            canceladas=canceladas,
            reemitidas=reemitidas,
            verificadas=verificadas,
            pendientes=pendientes,
            tiempo_promedio_horas=round(float(promedio), 1) if promedio else None,
        )


constancias_service = ConstanciasService()
