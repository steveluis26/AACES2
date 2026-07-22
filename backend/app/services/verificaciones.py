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
        # 1) Localizar el documento emitido por codigo_validacion (string o uuid).
        doc_row = await db.execute(
            text("""
                SELECT d.id, d.tipo_documento, d.estatus, d.fecha_emision,
                       d.pdf_hash, d.codigo_validacion, d.documento_metadata,
                       d.curso_participante_id,
                       o.razon_social, o.rfc, o.nombre_comercial,
                       o.estado, o.ciudad,
                       d.folio
                FROM aaces.documentos_emitidos d
                JOIN aaces.organizaciones o ON o.id = d.organizacion_id
                WHERE d.codigo_validacion::text = :codigo
                LIMIT 1
            """),
            {"codigo": str(codigo)},
        )
        row = doc_row.fetchone()

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

        (doc_id, tipo_doc, estatus, fecha_emision, pdf_hash, codigo_val,
         metadata, cp_id, razon_social, rfc, nombre_comercial,
         org_estado, org_ciudad, folio) = row

        # 2) Revocada / cancelada -> respuesta negativa pero con datos de la org.
        if estatus == "cancelado":
            await self._registrar(
                db=db, documento_id=doc_id, codigo=codigo,
                ip=ip, user_agent=user_agent, tipo=tipo,
                resultado=VerificationResult.REVOCADA
            )
            return VerificacionPublicResponse(
                valida=False, codigo_validacion=str(codigo_val),
                tipo_documento=tipo_doc, estatus=estatus,
                pdf_hash=pdf_hash, organizacion=razon_social,
                rfc=rfc, folio=folio, verificaciones_count=0,
            )

        await self._registrar(
            db=db, documento_id=doc_id, codigo=codigo,
            ip=ip, user_agent=user_agent, tipo=tipo,
            resultado=VerificationResult.VALIDA
        )

        # 3) Resolver participante + curso.
        #    Fuente de verdad: FK curso_participante_id. Fallback: por codigo_validacion.
        participante_data = None
        curso_data = None

        cp_lookup_sql = """
            SELECT cp.id, cp.participante_id, cp.curso_id,
                   cp.estado_acreditacion, cp.calificacion,
                   cp.fecha_inicio_vigencia, cp.fecha_expiracion,
                   p.nombre, p.apellido, p.empresa AS emp_participante,
                   c.nombre AS curso_nombre, c.fecha_inicio, c.fecha_fin,
                   c.duracion_horas, c.modalidad, c.empresa_contratante,
                   c.codigo_curso
            FROM aaces.curso_participante cp
            JOIN aaces.participantes p ON p.id = cp.participante_id
            JOIN aaces.cursos c ON c.id = cp.curso_id
            WHERE {where}
            LIMIT 1
        """

        if cp_id:
            cp_r = (await db.execute(
                text(cp_lookup_sql.format(where="cp.id = :cp_id")),
                {"cp_id": str(cp_id)},
            )).fetchone()
        else:
            cp_r = (await db.execute(
                text(cp_lookup_sql.format(where="cp.codigo_validacion = :codigo")),
                {"codigo": str(codigo_val)},
            )).fetchone()

        if cp_r:
            participante_data = {
                "nombre": f"{(cp_r[7] or '')} {(cp_r[8] or '')}".strip(),
                "empresa": cp_r[9] or None,
            }
            curso_data = {
                "nombre": cp_r[10] or "",
                "codigo_curso": cp_r[16] or None,
                "fecha_inicio": cp_r[11].isoformat() if cp_r[11] else None,
                "fecha_fin": cp_r[12].isoformat() if cp_r[12] else None,
                "duracion_horas": cp_r[13] or 0,
                "modalidad": cp_r[14] or None,
                "empresa_contratante": cp_r[15] or None,
                "calificacion": float(cp_r[4]) if cp_r[4] else None,
                "estado_acreditacion": bool(cp_r[3]) if cp_r[3] is not None else False,
                "inicio_vigencia": cp_r[5].isoformat() if cp_r[5] else None,
                "expiracion": cp_r[6].isoformat() if cp_r[6] else None,
            }

        count_row = await db.execute(
            text("""
                SELECT count(*) FROM aaces.verificaciones
                WHERE codigo = :codigo AND resultado = 'VALIDA'
            """),
            {"codigo": str(codigo_val)},
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
            nombre_comercial=nombre_comercial,
            rfc=rfc,
            org_estado=org_estado,
            org_ciudad=org_ciudad,
            folio=folio,
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
