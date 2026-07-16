import logging
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, func, select
from datetime import datetime

from app.models import Verificacion, DocumentoEmitido
from app.schemas import VerificacionPublicResponse, VerificacionRegistroResponse
from app.core.enums import VerificationType, VerificationResult

logger = logging.getLogger(__name__)


class VerificationService:

    async def verify(
        self,
        db: AsyncSession,
        codigo: str,
        ip: str,
        user_agent: str,
        tipo: str = VerificationType.QR,
    ) -> VerificacionPublicResponse:
        documento = await db.execute(
            text("""
                SELECT d.id, d.tipo_documento, d.estatus, d.fecha_emision,
                       d.pdf_hash, d.codigo_validacion, d.documento_metadata,
                       o.razon_social, d.folio
                FROM aaces.documentos_emitidos d
                JOIN aaces.organizaciones o ON o.id = d.organizacion_id
                WHERE d.codigo_validacion = :codigo
                LIMIT 1
            """),
            {"codigo": codigo}
        )
        row = documento.fetchone()

        if not row:
            await self._registrar(
                db=db, documento_id=None, codigo=codigo,
                ip=ip, user_agent=user_agent, tipo=tipo,
                resultado=VerificationResult.NO_EXISTE
            )
            return VerificacionPublicResponse(
                valida=False, codigo_validacion=codigo,
                tipo_documento="", estatus="no_existe",
                verificaciones_count=0,
            )

        doc_id, tipo_doc, estatus, fecha_emision, pdf_hash, codigo_val, metadata, razon_social, folio = row

        if estatus == "cancelado":
            await self._registrar(
                db=db, documento_id=doc_id, codigo=codigo,
                ip=ip, user_agent=user_agent, tipo=tipo,
                resultado=VerificationResult.REVOCADA
            )
            return VerificacionPublicResponse(
                valida=False, codigo_validacion=codigo,
                tipo_documento=tipo_doc, estatus=estatus,
                pdf_hash=pdf_hash, organizacion=razon_social,
                verificaciones_count=0,
            )

        await self._registrar(
            db=db, documento_id=doc_id, codigo=codigo,
            ip=ip, user_agent=user_agent, tipo=tipo,
            resultado=VerificationResult.VALIDA
        )

        participante_data = None
        curso_data = None

        if tipo_doc == "CONSTANCIA":
            meta = metadata or {}
            cp_id = meta.get("curso_participante_id") if isinstance(meta, dict) else None
            if not cp_id:
                cp_row = await db.execute(
                    text("""
                        SELECT cp.id FROM aaces.curso_participante cp
                        WHERE cp.codigo_validacion = :codigo
                        LIMIT 1
                    """),
                    {"codigo": codigo}
                )
                cp_r = cp_row.fetchone()
                if cp_r:
                    cp_id = str(cp_r[0])

            if cp_id:
                p_row = await db.execute(
                    text("""
                        SELECT p.nombre, p.apellido,
                               c.nombre as curso_nombre,
                               c.fecha_inicio, c.fecha_fin, c.duracion_horas,
                               cp.calificacion, cp.fecha_inicio_vigencia,
                               cp.fecha_expiracion
                        FROM aaces.curso_participante cp
                        JOIN aaces.participantes p ON p.id = cp.participante_id
                        JOIN aaces.cursos c ON c.id = cp.curso_id
                        WHERE cp.id = :cp_id
                        LIMIT 1
                    """),
                    {"cp_id": cp_id}
                )
                pr = p_row.fetchone()
                if pr:
                    participante_data = {
                        "nombre": f"{pr[0] or ''} {pr[1] or ''}".strip(),
                    }
                    curso_data = {
                        "nombre": pr[2] or "",
                        "fecha_inicio": pr[3].isoformat() if pr[3] else None,
                        "fecha_fin": pr[4].isoformat() if pr[4] else None,
                        "duracion_horas": pr[5] or 0,
                        "calificacion": float(pr[6]) if pr[6] else None,
                        "inicio_vigencia": pr[7].isoformat() if pr[7] else None,
                        "expiracion": pr[8].isoformat() if pr[8] else None,
                    }

        count_row = await db.execute(
            text("""
                SELECT count(*) FROM aaces.verificaciones
                WHERE codigo = :codigo AND resultado = 'VALIDA'
            """),
            {"codigo": codigo}
        )
        verificaciones_count = count_row.scalar() or 0

        return VerificacionPublicResponse(
            valida=True,
            codigo_validacion=str(codigo_val),
            tipo_documento=tipo_doc,
            estatus=estatus,
            fecha_emision=fecha_emision.isoformat() if fecha_emision else None,
            pdf_hash=pdf_hash,
            organizacion=razon_social,
            participante=participante_data,
            curso=curso_data,
            verificaciones_count=verificaciones_count,
        )

    async def historial(
        self,
        db: AsyncSession,
        documento_id: str,
        organizacion_id: str,
    ) -> List[VerificacionRegistroResponse]:
        doc = await db.execute(
            text("""
                SELECT id FROM aaces.documentos_emitidos
                WHERE id = :id AND organizacion_id = :org_id
                LIMIT 1
            """),
            {"id": documento_id, "org_id": organizacion_id}
        )
        if not doc.fetchone():
            return []

        rows = await db.execute(
            text("""
                SELECT id, fecha, ip, user_agent, tipo, resultado
                FROM aaces.verificaciones
                WHERE documento_id = :doc_id
                ORDER BY fecha DESC
                LIMIT 100
            """),
            {"doc_id": documento_id}
        )
        return [
            VerificacionRegistroResponse(
                id=str(r[0]),
                fecha=r[1],
                ip=r[2],
                user_agent=r[3],
                tipo=r[4],
                resultado=r[5],
            )
            for r in rows.fetchall()
        ]

    async def _registrar(
        self,
        db: AsyncSession,
        documento_id: Optional[str],
        codigo: str,
        ip: str,
        user_agent: str,
        tipo: str,
        resultado: str,
    ):
        try:
            await db.execute(
                text("""
                    INSERT INTO aaces.verificaciones
                        (id, documento_id, codigo, ip, user_agent, tipo, resultado)
                    VALUES
                        (gen_random_uuid(), :doc_id, :codigo, :ip, :ua, :tipo, :resultado)
                """),
                {
                    "doc_id": documento_id,
                    "codigo": codigo,
                    "ip": ip,
                    "ua": user_agent,
                    "tipo": tipo,
                    "resultado": resultado,
                }
            )
            await db.commit()
        except Exception as e:
            logger.error(f"Error registrando verificacion: {e}")
            await db.rollback()


verification_service = VerificationService()
