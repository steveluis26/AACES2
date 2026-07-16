import uuid
import logging
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from datetime import datetime

from app.services.document_service import DocumentService
from app.services.storage_provider import LocalStorageProvider, StorageProvider
from app.core.config import settings

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
                SELECT cp.id, cp.curso_id, cp.participante_id, cp.estado_acreditacion,
                       cp.calificacion, cp.asistencia,
                       cp.fecha_inicio_vigencia, cp.fecha_expiracion,
                       c.nombre as curso_nombre,
                       c.fecha_inicio, c.fecha_fin, c.duracion_horas,
                       c.cliente_id, cl.organizacion_id,
                       p.nombre as part_nombre, p.apellido as part_apellido,
                       p.correo as part_correo
                FROM aaces.curso_participante cp
                JOIN aaces.cursos c ON c.id = cp.curso_id
                JOIN aaces.clientes cl ON cl.id = c.cliente_id
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

        codigo_validacion = str(uuid.uuid4())
        now = datetime.utcnow()

        participante_nombre = f"{cp.part_nombre or ''} {cp.part_apellido or ''}".strip()
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
        }

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

        qr_data = f"https://aaces-backend-3hw1.onrender.com/api/v1/validaciones/{codigo_validacion}"

        result = await self._doc_service.generate(
            html_template=html,
            data=data,
            qr_data=qr_data,
            recursos=recursos,
            config=config,
            storage_key=f"{organizacion_id}/CONSTANCIA/{codigo_validacion}.pdf",
        )

        doc_id = str(uuid.uuid4())
        metadata_val = str({
            "curso_participante_id": curso_participante_id,
            "curso_id": str(cp.curso_id),
            "participante_id": str(cp.participante_id),
        })

        await db.execute(
            text("""
                INSERT INTO aaces.documentos_emitidos
                    (id, organizacion_id, template_id, template_version, tipo_documento,
                     codigo_validacion, storage_provider, storage_key, pdf_hash,
                     html_snapshot, documento_metadata, emitido_por, estatus)
                VALUES
                    (:id, :org_id, :template_id, :version, 'CONSTANCIA',
                     :codigo, :provider, :skey, :hash,
                     :snapshot, :meta, :emitido_por, 'emitido')
            """),
            {
                "id": doc_id, "org_id": organizacion_id,
                "template_id": t_id, "version": t_version,
                "codigo": codigo_validacion,
                "provider": result.storage_provider,
                "skey": result.storage_key,
                "hash": result.pdf_hash,
                "snapshot": result.html_snapshot,
                "meta": metadata_val,
                "emitido_por": emitido_por,
            }
        )

        storage_url = await self._storage.url(result.storage_key)
        await db.execute(
            text("""
                UPDATE aaces.curso_participante
                SET codigo_validacion = :codigo,
                    certificado_url = :url,
                    fecha_emision_certificado = :fecha_emision,
                    fecha_expiracion = CASE
                        WHEN :fecha_exp IS NOT NULL THEN :fecha_exp::date
                        ELSE fecha_expiracion
                    END
                WHERE id = :cp_id
            """),
            {
                "codigo": codigo_validacion,
                "url": storage_url,
                "fecha_emision": now,
                "fecha_exp": cp.fecha_expiracion.isoformat() if cp.fecha_expiracion else None,
                "cp_id": curso_participante_id,
            }
        )

        await db.commit()

        return {
            "id": doc_id,
            "codigo_validacion": codigo_validacion,
            "pdf_hash": result.pdf_hash,
            "descarga_url": storage_url,
            "participante_nombre": participante_nombre,
            "curso_nombre": cp.curso_nombre,
            "fecha_emision": now.isoformat(),
        }

    async def listar(
        self,
        db: AsyncSession,
        organizacion_id: str,
        curso_id: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        conditions = ["d.organizacion_id = :org_id", "d.tipo_documento = 'CONSTANCIA'"]
        params: Dict[str, Any] = {"org_id": organizacion_id, "limit": limit, "offset": offset}

        if curso_id:
            conditions.append("c.id = :curso_id")
            params["curso_id"] = curso_id

        where = " AND ".join(conditions)

        rows = await db.execute(
            text(f"""
                SELECT d.id, d.codigo_validacion, d.estatus, d.fecha_emision,
                       d.pdf_hash, d.storage_key,
                       p.nombre as part_nombre, p.apellido as part_apellido,
                       c.nombre as curso_nombre
                FROM aaces.documentos_emitidos d
                LEFT JOIN aaces.curso_participante cp ON cp.codigo_validacion = d.codigo_validacion
                LEFT JOIN aaces.participantes p ON p.id = cp.participante_id
                LEFT JOIN aaces.cursos c ON c.id = cp.curso_id AND c.cliente_id IN (
                    SELECT id FROM aaces.clientes WHERE organizacion_id = :org_id
                )
                WHERE {where}
                ORDER BY d.fecha_emision DESC
                LIMIT :limit OFFSET :offset
            """),
            params
        )

        return [
            {
                "id": str(r[0]),
                "codigo_validacion": str(r[1]),
                "estatus": r[2],
                "fecha_emision": r[3].isoformat() if r[3] else None,
                "pdf_hash": r[4],
                "descarga_url": f"/api/v1/documentos/{str(r[0])}/download",
                "participante_nombre": f"{r[6] or ''} {r[7] or ''}".strip(),
                "curso_nombre": r[8],
            }
            for r in rows.fetchall()
        ]


constancias_service = ConstanciasService()
