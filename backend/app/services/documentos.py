import uuid
import logging
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from datetime import datetime

from app.services.document_service import DocumentService
from app.services.storage_provider import LocalStorageProvider, StorageProvider
from app.core.config import settings
from app.core.enums import VerificationType

logger = logging.getLogger(__name__)


def _get_storage() -> StorageProvider:
    provider = settings.STORAGE_PROVIDER
    if provider == "local":
        return LocalStorageProvider(base_dir=settings.STORAGE_DIR)
    return LocalStorageProvider(base_dir=settings.STORAGE_DIR)


class DocumentosService:

    def __init__(self):
        self._storage = _get_storage()
        self._doc_service = DocumentService(storage_provider=self._storage)

    async def generar(
        self,
        db: AsyncSession,
        organizacion_id: str,
        template_id: str,
        data: Dict[str, Any],
        emitido_por: Optional[str] = None,
        extra_metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        template_res = await db.execute(
            text("""
                SELECT id, organizacion_id, tipo_documento, version, html_template, recursos, config
                FROM aaces.templates
                WHERE id = :id AND organizacion_id = :org_id AND activa = true
                LIMIT 1
            """),
            {"id": template_id, "org_id": organizacion_id}
        )
        template = template_res.fetchone()
        if not template:
            available = await db.execute(
                text("""
                    SELECT id, version, activa
                    FROM aaces.templates
                    WHERE id = :id AND organizacion_id = :org_id
                    LIMIT 1
                """),
                {"id": template_id, "org_id": organizacion_id}
            )
            row = available.fetchone()
            if not row:
                raise ValueError("Plantilla no encontrada")
            raise ValueError(f"Plantilla encontrada pero no está activa (version={row[1]}, activa={row[2]})")

        t_id, t_org, tipo_doc, version, html, recursos, config = template

        codigo_validacion = str(uuid.uuid4())
        qr_data = f"{settings.PUBLIC_VERIFICATION_URL}/{codigo_validacion}"

        result = await self._doc_service.generate(
            html_template=html,
            data=data,
            qr_data=qr_data,
            recursos=recursos,
            config=config,
            storage_key=f"{organizacion_id}/{tipo_doc}/{codigo_validacion}.pdf",
        )

        doc_id = str(uuid.uuid4())
        await db.execute(
            text("""
                INSERT INTO aaces.documentos_emitidos
                    (id, organizacion_id, template_id, template_version, tipo_documento,
                     codigo_validacion, storage_provider, storage_key, pdf_hash,
                     html_snapshot, documento_metadata, emitido_por, estatus)
                VALUES
                    (:id, :org_id, :template_id, :version, :tipo,
                     :codigo, :provider, :skey, :hash,
                     :snapshot, :meta, :emitido_por, 'emitido')
            """),
            {
                "id": doc_id, "org_id": organizacion_id,
                "template_id": t_id, "version": version,
                "tipo": tipo_doc, "codigo": codigo_validacion,
                "provider": result.storage_provider,
                "skey": result.storage_key,
                "hash": result.pdf_hash,
                "snapshot": result.html_snapshot,
                "meta": "{}" if not extra_metadata else str(extra_metadata),
                "emitido_por": emitido_por,
            }
        )
        await db.commit()

        storage_url = await self._storage.url(result.storage_key)

        return {
            "id": doc_id,
            "organizacion_id": organizacion_id,
            "template_id": t_id,
            "template_version": version,
            "tipo_documento": tipo_doc,
            "codigo_validacion": codigo_validacion,
            "pdf_hash": result.pdf_hash,
            "storage_key": result.storage_key,
            "descarga_url": storage_url,
            "estatus": "emitido",
            "fecha_emision": datetime.utcnow().isoformat(),
        }

    async def listar(
        self,
        db: AsyncSession,
        organizacion_id: str,
        tipo_documento: Optional[str] = None,
        estatus: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        conditions = ["d.organizacion_id = :org_id"]
        params: Dict[str, Any] = {"org_id": organizacion_id, "limit": limit, "offset": offset}
        if tipo_documento:
            conditions.append("d.tipo_documento = :tipo")
            params["tipo"] = tipo_documento
        if estatus:
            conditions.append("d.estatus = :estatus")
            params["estatus"] = estatus

        where = " AND ".join(conditions)

        rows = await db.execute(
            text(f"""
                SELECT d.id, d.tipo_documento, d.codigo_validacion, d.pdf_hash,
                       d.estatus, d.fecha_emision, d.documento_metadata, o.razon_social
                FROM aaces.documentos_emitidos d
                JOIN aaces.organizaciones o ON o.id = d.organizacion_id
                WHERE {where}
                ORDER BY d.fecha_emision DESC
                LIMIT :limit OFFSET :offset
            """),
            params
        )
        return [
            {
                "id": str(r[0]), "tipo_documento": r[1],
                "codigo_validacion": str(r[2]), "pdf_hash": r[3],
                "estatus": r[4],
                "fecha_emision": r[5].isoformat() if r[5] else None,
                "documento_metadata": r[6], "organizacion_razon_social": r[7],
            }
            for r in rows.fetchall()
        ]

    async def obtener(self, db: AsyncSession, doc_id: str, organizacion_id: str) -> Optional[Dict[str, Any]]:
        row = await db.execute(
            text("""
                SELECT id, organizacion_id, template_id, template_version, tipo_documento,
                       codigo_validacion, storage_provider, storage_key, pdf_hash,
                       html_snapshot, documento_metadata, emitido_por, fecha_emision, estatus
                FROM aaces.documentos_emitidos
                WHERE id = :id AND organizacion_id = :org_id
                LIMIT 1
            """),
            {"id": doc_id, "org_id": organizacion_id}
        )
        r = row.fetchone()
        if not r:
            return None
        return {
            "id": str(r[0]), "organizacion_id": str(r[1]),
            "template_id": str(r[2]) if r[2] else None,
            "template_version": r[3], "tipo_documento": r[4],
            "codigo_validacion": str(r[5]), "storage_provider": r[6],
            "storage_key": r[7], "pdf_hash": r[8],
            "html_snapshot": r[9], "documento_metadata": r[10],
            "emitido_por": str(r[11]) if r[11] else None,
            "fecha_emision": r[12].isoformat() if r[12] else None,
            "estatus": r[13],
        }

    async def descargar(self, db: AsyncSession, doc_id: str, organizacion_id: str) -> Optional[bytes]:
        doc = await self.obtener(db, doc_id, organizacion_id)
        if not doc or doc["estatus"] == "cancelado":
            return None
        if doc.get("storage_provider") == "plantilla_pdf":
            from app.api.v1.endpoints.plantillas_pdf import regenerar_documento
            return await regenerar_documento(db, doc["storage_key"], organizacion_id)
        return await self._storage.read(doc["storage_key"])

    async def cancelar(self, db: AsyncSession, doc_id: str, organizacion_id: str) -> bool:
        r = await db.execute(
            text("""
                UPDATE aaces.documentos_emitidos
                SET estatus = 'cancelado'
                WHERE id = :id AND organizacion_id = :org_id AND estatus = 'emitido'
                RETURNING id
            """),
            {"id": doc_id, "org_id": organizacion_id}
        )
        if r.fetchone():
            await db.commit()
            return True
        await db.rollback()
        return False


documentos_service = DocumentosService()
