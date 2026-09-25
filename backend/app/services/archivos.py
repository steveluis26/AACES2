"""Lectura de los PDF de constancias, con recuperación de los que se perdieron.

Antes los PDF se guardaban en el disco de Render, que se borra en cada deploy.
Si un PDF ya no existe se vuelve a generar desde lo que quedó en la base:
- DC-3 con plantilla del cliente: desde la plantilla y los datos del participante.
- Constancias HTML: desde el html_snapshot guardado al emitirlas (incluye su QR).
El PDF recuperado se guarda en la base para no regenerarlo otra vez."""
import logging
from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.storage_provider import get_storage

logger = logging.getLogger(__name__)


async def obtener_pdf(db: AsyncSession, storage_key: str, org_id: Optional[str] = None) -> Optional[bytes]:
    filtro = "AND organizacion_id = :org" if org_id else ""
    prm = {"k": storage_key, **({"org": org_id} if org_id else {})}
    doc = (await db.execute(
        text(f"""
            SELECT storage_provider, html_snapshot, codigo_validacion
            FROM aaces.documentos_emitidos
            WHERE storage_key = :k {filtro}
            ORDER BY fecha_emision DESC
            LIMIT 1
        """),
        prm,
    )).fetchone()

    if doc and doc[0] == "plantilla_pdf":
        from app.api.v1.endpoints.plantillas_pdf import regenerar_documento
        return await regenerar_documento(db, storage_key, org_id)

    storage = get_storage()
    try:
        return await storage.read(storage_key)
    except FileNotFoundError:
        pass

    if not doc or not doc[1]:
        return None
    try:
        from app.core.config import settings
        from app.services.qr_service import qr_service
        from app.services.renderer import renderer
        html = doc[1]
        # Si la plantilla usaba {{qr}}, el QR ya viene en el snapshot (SVG con su
        # cabecera XML); si no, el renderer lo había agregado al final: repetirlo.
        if "<?xml version='1.0'" not in html and doc[2]:
            qr_svg = await qr_service.generate(f"{settings.PUBLIC_VERIFICATION_URL}/{doc[2]}")
            html = renderer._inject_qr(html, qr_svg)
        pdf = renderer.render_html(html)
    except Exception:
        logger.exception("No se pudo regenerar el PDF %s", storage_key)
        return None
    await storage.save(storage_key, pdf)
    logger.info("PDF recuperado desde html_snapshot: %s", storage_key)
    return pdf
