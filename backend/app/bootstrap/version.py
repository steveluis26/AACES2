from __future__ import annotations
import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

logger = logging.getLogger(__name__)

CURRENT_SCHEMA_VERSION = 9


async def ensure_schema_version(conn: AsyncConnection) -> None:
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS aaces.schema_version (
          version INTEGER PRIMARY KEY,
          applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          description TEXT
        )
    """))
    await conn.execute(
        text("""
            INSERT INTO aaces.schema_version (version, description)
            VALUES (:v, :desc)
            ON CONFLICT (version) DO NOTHING
        """),
        {"v": CURRENT_SCHEMA_VERSION, "desc": "lista de espera del directorio + perfil publico de organizacion (V009)"},
    )
    logger.info("Schema version %d ensured.", CURRENT_SCHEMA_VERSION)
