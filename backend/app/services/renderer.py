from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from weasyprint import HTML

from app.services.document_types import DocumentDefinition


class Renderer(ABC):

    @abstractmethod
    async def render(
        self,
        doc: DocumentDefinition,
        qr_svg: str,
    ) -> bytes: ...


class WeasyPrintRenderer(Renderer):

    async def render(
        self,
        doc: DocumentDefinition,
        qr_svg: str,
    ) -> bytes:
        from weasyprint import HTML
        html = self._inject_qr(doc.html, qr_svg)
        pdf_bytes = HTML(string=html).write_pdf()
        return pdf_bytes

    def render_html(self, html: str) -> bytes:
        """PDF desde HTML ya renderizado (p. ej. el html_snapshot de un documento emitido)."""
        from weasyprint import HTML
        return HTML(string=html).write_pdf()

    def _inject_qr(self, html: str, qr_svg: str) -> str:
        # La plantilla ya lo trae (Jinja sustituyó {{qr}}): no agregar un segundo QR
        if qr_svg and qr_svg in html:
            return html
        placeholder = "{{qr}}"
        if placeholder in html:
            return html.replace(placeholder, qr_svg)
        marker = "</body>"
        if marker in html:
            qr_html = f'<div style="position:fixed;bottom:20px;right:20px;">{qr_svg}</div>{marker}'
            return html.replace(marker, qr_html)
        return html + f"<div>{qr_svg}</div>"


try:
    renderer = WeasyPrintRenderer()
except Exception as e:
    import logging
    logging.getLogger(__name__).warning(f"WeasyPrintRenderer not available: {e}")
    renderer = None
