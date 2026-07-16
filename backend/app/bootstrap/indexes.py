from __future__ import annotations
import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

logger = logging.getLogger(__name__)

INDEX_SQL = [
    "CREATE INDEX IF NOT EXISTS idx_templates_org_tipo ON aaces.templates (organizacion_id, tipo_documento)",
    "CREATE INDEX IF NOT EXISTS idx_templates_org_activa ON aaces.templates (organizacion_id, activa)",
    "CREATE INDEX IF NOT EXISTS idx_templates_group_id ON aaces.templates (template_group_id)",
    "CREATE INDEX IF NOT EXISTS idx_docs_org_tipo ON aaces.documentos_emitidos (organizacion_id, tipo_documento)",
    "CREATE INDEX IF NOT EXISTS idx_docs_validacion ON aaces.documentos_emitidos (codigo_validacion)",
    "CREATE INDEX IF NOT EXISTS idx_docs_emision ON aaces.documentos_emitidos (fecha_emision)",
    "CREATE INDEX IF NOT EXISTS idx_docs_org_emision ON aaces.documentos_emitidos (organizacion_id, fecha_emision DESC)",
    "CREATE INDEX IF NOT EXISTS idx_docs_org_estado ON aaces.documentos_emitidos (organizacion_id, estatus)",
    "CREATE INDEX IF NOT EXISTS idx_docs_folio ON aaces.documentos_emitidos (folio)",
    "CREATE INDEX IF NOT EXISTS idx_verificaciones_codigo ON aaces.verificaciones (codigo)",
    "CREATE INDEX IF NOT EXISTS idx_verificaciones_fecha ON aaces.verificaciones (fecha)",
    "CREATE INDEX IF NOT EXISTS idx_verificaciones_documento ON aaces.verificaciones (documento_id)",
    "CREATE INDEX IF NOT EXISTS idx_clientes_org_id ON aaces.clientes (organizacion_id)",
]


async def ensure_indexes(conn: AsyncConnection) -> None:
    for sql in INDEX_SQL:
        try:
            await conn.execute(text(sql))
        except Exception as e:
            logger.warning(f"Index creation failed: {e}")
