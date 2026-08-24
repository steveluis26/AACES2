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

    def _inject_qr(self, html: str, qr_svg: str) -> str:
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
