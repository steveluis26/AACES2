from __future__ import annotations
import logging
from dataclasses import dataclass, field
from typing import Optional, Literal
from sqlalchemy.ext.asyncio import AsyncConnection
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError
from app.db.errors import is_undefined_table

logger = logging.getLogger(__name__)

REQUIRED_TABLES = [
    "aaces.organizaciones",
    "aaces.templates",
    "aaces.documentos_emitidos",
    "aaces.verificaciones",
    "aaces.clientes",
]


@dataclass
class SchemaHealth:
    status: Literal["OK", "PARTIAL", "BROKEN"]
    schema_version: Optional[int] = None
    missing_tables: list[str] = field(default_factory=list)


async def check_schema_health(conn: AsyncConnection) -> SchemaHealth:
    missing: list[str] = []
    for table in REQUIRED_TABLES:
        try:
            result = await conn.execute(
                text(
                    "SELECT to_regclass(:table) IS NOT NULL AS exists"
                ),
                {"table": table},
            )
            row = result.fetchone()
            if not row or not row[0]:
                missing.append(table)
        except ProgrammingError as e:
            if is_undefined_table(e):
                missing.append(table)
            else:
                logger.warning(f"Could not check table {table}: {e}")
                missing.append(table)

    schema_version: Optional[int] = None
    try:
        result = await conn.execute(
            text("SELECT MAX(version) FROM aaces.schema_version")
        )
        row = result.fetchone()
        if row:
            schema_version = int(row[0]) if row[0] else None
    except ProgrammingError:
        pass

    if not missing:
        status: Literal["OK", "PARTIAL", "BROKEN"] = "OK"
    elif all("clientes" not in m for m in missing):
        status = "PARTIAL"
    else:
        status = "BROKEN"

    if missing:
        logger.warning(
            "Schema health: %s | version=%s | missing=%s",
            status, schema_version, missing,
        )
    else:
        logger.info(
            "Schema health: %s | version=%s", status, schema_version,
        )

    return SchemaHealth(
        status=status,
        schema_version=schema_version,
        missing_tables=missing,
    )
