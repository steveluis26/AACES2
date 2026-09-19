import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.core.database import get_db
from app.core.identity import require_org_identity, Identity
from app.services.documentos import documentos_service
from app.schemas import DocumentoGenerarRequest, DocumentoResponse, DocumentoListResponse, DocumentoGenerarResponse
from app.core.logging import audit_logger

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/generar", response_model=DocumentoGenerarResponse)
async def generar_documento(
    payload: DocumentoGenerarRequest,
    identity: Identity = Depends(require_org_identity),
    db: AsyncSession = Depends(get_db),
):
    organizacion_id = identity.org_id
    try:
        doc = await documentos_service.generar(
            db=db,
            organizacion_id=organizacion_id,
            template_id=str(payload.template_id),
            data=payload.data,
            emitido_por=identity.user_id,
            extra_metadata=payload.documento_metadata,
        )
        audit_logger.log_user_action(
            user_id=identity.user_id,
            action="documento_emitido",
            resource="documentos",
            details={"doc_id": doc["id"], "tipo": doc["tipo_documento"]},
        )
        return DocumentoGenerarResponse(
            success=True,
            documento=DocumentoResponse(
                id=doc["id"],
                organizacion_id=doc["organizacion_id"],
                template_id=doc["template_id"],
                template_version=doc["template_version"],
                tipo_documento=doc["tipo_documento"],
                codigo_validacion=doc["codigo_validacion"],
                pdf_hash=doc["pdf_hash"],
                storage_key=doc["storage_key"],
                estatus=doc["estatus"],
                fecha_emision=doc["fecha_emision"],
            ),
            descarga_url=doc["descarga_url"],
            codigo_validacion=doc["codigo_validacion"],
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception(f"Error generando documento: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al generar documento")


@router.get("", response_model=list[dict])
async def listar_documentos(
    tipo_documento: Optional[str] = Query(None, pattern="^(CONSTANCIA|DC3|DIPLOMA|CREDENCIAL|OTRO)$"),
    estatus: Optional[str] = Query(None, pattern="^(emitido|cancelado|reemitido)$"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    identity: Identity = Depends(require_org_identity),
    db: AsyncSession = Depends(get_db),
):
    organizacion_id = identity.org_id
    return await documentos_service.listar(
        db=db,
        organizacion_id=organizacion_id,
        tipo_documento=tipo_documento,
        estatus=estatus,
        limit=limit,
        offset=offset,
    )


@router.get("/{doc_id}")
async def obtener_documento(
    doc_id: str,
    identity: Identity = Depends(require_org_identity),
    db: AsyncSession = Depends(get_db),
):
    organizacion_id = identity.org_id
    doc = await documentos_service.obtener(db, doc_id, organizacion_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Documento no encontrado")
    return doc


@router.get("/{doc_id}/download")
async def descargar_documento(
    doc_id: str,
    identity: Identity = Depends(require_org_identity),
    db: AsyncSession = Depends(get_db),
):
    organizacion_id = identity.org_id
    pdf = await documentos_service.descargar(db, doc_id, organizacion_id)
    if not pdf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Documento no encontrado o cancelado")

    doc = await documentos_service.obtener(db, doc_id, organizacion_id)
    filename = f"{doc['tipo_documento']}_{doc['codigo_validacion']}.pdf"

    return StreamingResponse(
        content=iter([pdf]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.patch("/{doc_id}/cancelar")
async def cancelar_documento(
    doc_id: str,
    identity: Identity = Depends(require_org_identity),
    db: AsyncSession = Depends(get_db),
):
    organizacion_id = identity.org_id
    ok = await documentos_service.cancelar(db, doc_id, organizacion_id)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se pudo cancelar. El documento no existe, no pertenece a tu organización o ya fue cancelado.",
        )
    audit_logger.log_user_action(
        user_id=identity.user_id,
        action="documento_cancelado",
        resource="documentos",
        details={"doc_id": doc_id},
    )
    return {"success": True, "message": "Documento cancelado"}


@router.get("/{doc_id}/verificar")
async def verificar_documento_publico(
    doc_id: str,
    db: AsyncSession = Depends(get_db),
):
    from fastapi.responses import RedirectResponse
    from app.core.config import settings
    row = await db.execute(
        text("""
            SELECT codigo_validacion
            FROM aaces.documentos_emitidos
            WHERE id = :id
            LIMIT 1
        """),
        {"id": doc_id}
    )
    r = row.fetchone()
    if not r:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Documento no encontrado")
    redirect_url = f"{settings.PUBLIC_VERIFICATION_URL}/{r[0]}"
    return RedirectResponse(url=redirect_url, status_code=302)
