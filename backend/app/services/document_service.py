from typing import Dict, Any, Optional

from app.services.document_types import DocumentResult
from app.services.template_engine import template_engine
from app.services.renderer import renderer
from app.services.qr_service import qr_service
from app.services.hash_service import hash_service
from app.services.storage_provider import StorageProvider


class DocumentService:

    def __init__(self, storage_provider: StorageProvider):
        self._storage = storage_provider

    async def generate(
        self,
        html_template: str,
        data: Dict[str, Any],
        qr_data: str,
        recursos: Optional[Dict[str, Optional[str]]] = None,
        config: Optional[Dict[str, Any]] = None,
        storage_key: Optional[str] = None,
    ) -> DocumentResult:
        qr_svg = await qr_service.generate(qr_data)

        # Inyectar el QR en el contexto de Jinja para que {{qr}} se resuelva
        # dentro del template (el renderer también tiene fallback por si queda {{qr}}).
        render_data = dict(data)
        render_data["qr"] = qr_svg

        doc_def = await template_engine.render(
            html_template=html_template,
            data=render_data,
            recursos=recursos,
            config=config,
        )

        pdf_bytes = await renderer.render(doc_def, qr_svg)

        pdf_hash = await hash_service.sha256(pdf_bytes)

        if storage_key is None:
            import uuid
            storage_key = f"documents/{uuid.uuid4()}.pdf"
        await self._storage.save(storage_key, pdf_bytes)

        storage_provider_name = getattr(self._storage, "_provider_name", type(self._storage).__name__)

        return DocumentResult(
            storage_provider=storage_provider_name,
            storage_key=storage_key,
            pdf_hash=pdf_hash,
            html_snapshot=doc_def.html,
        )
