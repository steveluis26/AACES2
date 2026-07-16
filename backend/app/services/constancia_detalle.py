import logging
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from datetime import datetime

from app.core.config import settings
from app.core.enums import TimelineEventType
from app.schemas.capabilities import DocumentCapabilities
from app.schemas import (
    ConstanciaDetalleResponse,
    ParticipanteResumen,
    CursoResumen,
    OrganizacionResumen,
    ActivoDocumental,
    TemplateInfo,
    VerificacionResumen,
    VerificacionesInfo,
    TimelineEvent,
)

logger = logging.getLogger(__name__)


class ConstanciaDetalleService:

    async def obtener(
        self,
        db: AsyncSession,
        documento_id: str,
        organizacion_id: str,
    ) -> Optional[ConstanciaDetalleResponse]:
        doc = await db.execute(
            text("""
                SELECT d.id, d.tipo_documento, d.estatus, d.codigo_validacion,
                       d.folio, d.fecha_emision, d.pdf_hash, d.storage_key,
                       d.template_id, d.template_version,
                       d.documento_metadata,
                       o.id as org_id, o.razon_social, o.nombre_comercial,
                       t.nombre as template_nombre
                FROM aaces.documentos_emitidos d
                JOIN aaces.organizaciones o ON o.id = d.organizacion_id
                LEFT JOIN aaces.templates t ON t.id = d.template_id
                WHERE d.id = :id AND d.organizacion_id = :org_id
                LIMIT 1
            """),
            {"id": documento_id, "org_id": organizacion_id}
        )
        row = doc.fetchone()
        if not row:
            return None

        (doc_id, tipo_doc, estatus, codigo_val, folio, fecha_emision,
         pdf_hash, storage_key, template_id, template_version,
         metadata, org_id, razon_social, nombre_comercial,
         template_nombre) = row

        pdf_url = f"{settings.PUBLIC_API_BASE_URL}/documentos/{doc_id}/download"

        participante = ParticipanteResumen(nombre="")
        curso = CursoResumen(nombre="")
        fecha_expiracion = None

        if metadata and isinstance(metadata, dict):
            cp_id = metadata.get("curso_participante_id")
            if cp_id:
                cp = await db.execute(
                    text("""
                        SELECT p.nombre, p.apellido, p.correo,
                               p.empresa, p.cargo,
                               c.nombre, c.codigo_curso,
                               c.fecha_inicio, c.fecha_fin,
                               c.duracion_horas, c.modalidad, c.ciudad,
                               cp.fecha_expiracion
                        FROM aaces.curso_participante cp
                        JOIN aaces.participantes p ON p.id = cp.participante_id
                        JOIN aaces.cursos c ON c.id = cp.curso_id
                        WHERE cp.id = :cp_id
                        LIMIT 1
                    """),
                    {"cp_id": cp_id}
                )
                pr = cp.fetchone()
                if pr:
                    participante = ParticipanteResumen(
                        nombre=f"{pr[0] or ''} {pr[1] or ''}".strip(),
                        correo=pr[2],
                        empresa=pr[3],
                        puesto=pr[4],
                    )
                    curso = CursoResumen(
                        nombre=pr[5] or "",
                        codigo_curso=pr[6],
                        fecha_inicio=pr[7],
                        fecha_fin=pr[8],
                        duracion_horas=pr[9],
                        modalidad=pr[10],
                        ciudad=pr[11],
                    )
                    fecha_expiracion = pr[12]

        org_logo = None
        if metadata and isinstance(metadata, dict):
            org_logo = metadata.get("logo_url")

        organizacion_data = OrganizacionResumen(
            id=org_id,
            nombre=razon_social,
            nombre_comercial=nombre_comercial,
            logo_url=org_logo,
        )

        activo = ActivoDocumental(
            pdf_url=pdf_url,
            hash_sha256=pdf_hash,
            tipo_documento=tipo_doc,
        )

        template_info = TemplateInfo(
            id=template_id,
            nombre=template_nombre or "",
            version=template_version or 0,
        )

        verif_rows = await db.execute(
            text("""
                SELECT id, fecha, tipo, resultado, ip
                FROM aaces.verificaciones
                WHERE codigo = :codigo
                ORDER BY fecha DESC
                LIMIT 50
            """),
            {"codigo": str(codigo_val)}
        )
        verificaciones_list = []
        total_verificaciones = 0
        ultima_fecha = None
        for vr in verif_rows.fetchall():
            total_verificaciones += 1
            v = VerificacionResumen(
                id=str(vr[0]),
                fecha=vr[1],
                tipo=vr[2],
                resultado=vr[3],
                ip=vr[4],
            )
            verificaciones_list.append(v)
            if ultima_fecha is None or vr[1] > ultima_fecha:
                ultima_fecha = vr[1]

        verificaciones_info = VerificacionesInfo(
            total=total_verificaciones,
            ultima_fecha=ultima_fecha,
            ultimas=verificaciones_list[:10],
        )

        timeline = self._construir_timeline(
            fecha_emision=fecha_emision,
            estatus=estatus,
            verificaciones=verificaciones_list,
        )

        codigo_str = str(codigo_val) if codigo_val else ""

        return ConstanciaDetalleResponse(
            id=doc_id,
            tipo_documento=tipo_doc,
            estado=estatus,
            codigo_validacion=codigo_str,
            folio=folio,
            fecha_emision=fecha_emision,
            fecha_expiracion=fecha_expiracion,
            participante=participante,
            curso=curso,
            organizacion=organizacion_data,
            activo_documental=activo,
            template=template_info,
            verificaciones=verificaciones_info,
            timeline=timeline,
            capabilities=DocumentCapabilities(
                cancelar=estatus in ("emitido", "reemitido"),
                reemitir=False,
                descargar=estatus in ("emitido", "reemitido"),
                compartir=estatus in ("emitido", "reemitido"),
            ),
        )

    def _construir_timeline(
        self,
        fecha_emision: datetime,
        estatus: str,
        verificaciones: list,
    ) -> list:
        events = []

        events.append(TimelineEvent(
            fecha=fecha_emision,
            tipo=TimelineEventType.EMITIDA,
            titulo="Constancia emitida",
            descripcion=None,
        ))

        for v in verificaciones:
            tipo_label = {
                "QR": "Verificada mediante QR",
                "LINK": "Verificada mediante enlace",
                "API": "Verificada mediante API",
            }.get(v.tipo, "Verificada")
            events.append(TimelineEvent(
                fecha=v.fecha,
                tipo=TimelineEventType.VERIFICADA,
                titulo=tipo_label,
                descripcion=f"Desde IP {v.ip}" if v.ip else None,
                metadata={"resultado": v.resultado},
            ))

        if estatus == "cancelado":
            events.append(TimelineEvent(
                fecha=fecha_emision,
                tipo=TimelineEventType.CANCELADA,
                titulo="Constancia cancelada",
                descripcion=None,
            ))

        events.sort(key=lambda e: e.fecha, reverse=True)
        return events


constancia_detalle_service = ConstanciaDetalleService()
