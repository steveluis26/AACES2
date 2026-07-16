from jinja2 import Template as JinjaTemplate
from typing import Dict, Any, Optional

from app.services.document_types import DocumentDefinition


class TemplateEngine:

    async def render(
        self,
        html_template: str,
        data: Dict[str, Any],
        recursos: Optional[Dict[str, Optional[str]]] = None,
        config: Optional[Dict[str, Any]] = None,
    ) -> DocumentDefinition:
        jinja = JinjaTemplate(html_template)
        rendered = jinja.render(**data)
        return DocumentDefinition(
            html=rendered,
            recursos=recursos or {},
            config=config or {},
        )


template_engine = TemplateEngine()
