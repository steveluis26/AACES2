from __future__ import annotations
import logging
import uuid
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

logger = logging.getLogger(__name__)


async def ensure_seed_data(conn: AsyncConnection, hash_password_fn) -> None:
    await _ensure_plans(conn)
    await _ensure_admin(conn, hash_password_fn)


async def _ensure_plans(conn: AsyncConnection) -> None:
    res = await conn.execute(text("SELECT COUNT(*) FROM aaces.planes"))
    if int(res.scalar() or 0) > 0:
        return

    await conn.execute(
        text("""
            INSERT INTO aaces.planes (id, codigo, nombre, descripcion, precio_mensual, cursos_max, usuarios_max, constancias_max, incluye_soporte_prioritario, activo)
            VALUES (gen_random_uuid(), 'trial', 'Prueba', 'Plan gratuito para probar la plataforma', 0, 10, 1, 50, false, true)
        """)
    )
    await conn.execute(
        text("""
            INSERT INTO aaces.planes (id, codigo, nombre, descripcion, precio_mensual, cursos_max, usuarios_max, constancias_max, incluye_soporte_prioritario, activo)
            VALUES (gen_random_uuid(), 'profesional', 'Profesional', 'Plan ideal para capacitadoras en crecimiento', 399, 999999, 3, 500, true, true)
        """)
    )
    await conn.execute(
        text("""
            INSERT INTO aaces.planes (id, codigo, nombre, descripcion, precio_mensual, cursos_max, usuarios_max, constancias_max, incluye_marketplace, incluye_api, incluye_white_label, incluye_soporte_prioritario, activo)
            VALUES (gen_random_uuid(), 'empresa', 'Empresa', 'Solución completa para grandes organizaciones', 799, 999999, 999999, 999999, true, true, true, true, true)
        """)
    )
    logger.info("Default plans seeded successfully")


async def _ensure_admin(conn: AsyncConnection, hash_password_fn) -> None:
    PROBLEM_ID = "73d2bb00-cde6-4255-bd27-d1282c4e83ff"
    
    # Check if admin already exists with a VALID (non-problem) ID
    existing_valid = await conn.execute(
        text("SELECT id FROM aaces.usuarios WHERE TRIM(correo) ILIKE 'admin@aaces.com' AND id != :pid LIMIT 1"),
        {"pid": PROBLEM_ID}
    )
    if existing_valid.scalar():
        logger.info("Admin already exists with valid ID, skipping seed")
        return
    
    # Check if problematic admin exists
    problematic = await conn.execute(
        text("SELECT id FROM aaces.usuarios WHERE id = :pid"),
        {"pid": PROBLEM_ID}
    )
    if not problematic.scalar():
        # Also check clientes table
        problematic = await conn.execute(
            text("SELECT id FROM aaces.clientes WHERE id = :pid"),
            {"pid": PROBLEM_ID}
        )
        if not problematic.scalar():
            logger.info("No problematic admin found, checking if any admin exists...")
            # Check if any admin exists at all
            any_admin = await conn.execute(
                text("SELECT id FROM aaces.usuarios WHERE TRIM(correo) ILIKE 'admin@aaces.com' LIMIT 1")
            )
            if any_admin.scalar():
                logger.info("Admin exists with valid ID, skipping seed")
                return
            logger.info("No admin found at all, creating fresh admin")
            # Continue to create fresh admin
    
    # NUCLEAR: Delete ALL users with admin email in both tables, then recreate
    logger.info("Nuclear cleanup: deleting any admin@aaces.com from usuarios and clientes...")
    # First, capture org_ids that have admin@aaces.com users (before deleting them)
    # Use TRIM and ILIKE to catch variants with spaces/case differences
    org_res = await conn.execute(text("SELECT DISTINCT organizacion_id FROM aaces.usuarios WHERE TRIM(correo) ILIKE 'admin@aaces.com'"))
    org_ids = [row[0] for row in org_res.fetchall()]
    # Also delete by the known problematic ID directly
    await conn.execute(text("UPDATE aaces.templates SET creada_por = NULL WHERE creada_por = '73d2bb00-cde6-4255-bd27-d1282c4e83ff'"))
    await conn.execute(text("UPDATE aaces.documentos_emitidos SET emitido_por = NULL WHERE emitido_por = '73d2bb00-cde6-4255-bd27-d1282c4e83ff'"))
    await conn.execute(text("DELETE FROM aaces.usuarios WHERE id = '73d2bb00-cde6-4255-bd27-d1282c4e83ff'"))
    await conn.execute(text("DELETE FROM aaces.clientes WHERE id = '73d2bb00-cde6-4255-bd27-d1282c4e83ff'"))
    await conn.execute(text("UPDATE aaces.templates SET creada_por = NULL WHERE creada_por IN (SELECT id FROM aaces.usuarios WHERE TRIM(correo) ILIKE 'admin@aaces.com')"))
    await conn.execute(text("UPDATE aaces.documentos_emitidos SET emitido_por = NULL WHERE emitido_por IN (SELECT id FROM aaces.usuarios WHERE TRIM(correo) ILIKE 'admin@aaces.com')"))
    result_usuarios = await conn.execute(text("DELETE FROM aaces.usuarios WHERE TRIM(correo) ILIKE 'admin@aaces.com'"))
    result_clientes = await conn.execute(text("DELETE FROM aaces.clientes WHERE TRIM(correo) ILIKE 'admin@aaces.com'"))
    logger.info(f"Nuclear cleanup done: usuarios deleted={result_usuarios.rowcount}, clientes deleted={result_clientes.rowcount}")
    
    # Deactivate old organizations that had admin@aaces.com (prevents duplicate login matches)
    for org_id in org_ids:
        await conn.execute(text("UPDATE aaces.organizaciones SET estatus = 'cancelada' WHERE id = :id"), {"id": org_id})
    if org_ids:
        logger.info(f"Deactivated {len(org_ids)} old organizations")
    
    # Create fresh admin with new UUID - REUSE existing org with RFC (don't create duplicate)
    ph = hash_password_fn("admin123")
    org_res = await conn.execute(text("SELECT id FROM aaces.organizaciones WHERE rfc = 'AAC123456789' LIMIT 1"))
    org_id = org_res.scalar()
    if org_id is None:
        org_res = await conn.execute(text("INSERT INTO aaces.organizaciones (id, rfc, razon_social, estatus) VALUES (gen_random_uuid(), 'AAC123456789', 'AACES Demo', 'activa') RETURNING id"))
        org_id = org_res.scalar()
    else:
        # Reactivate if it was cancelled
        await conn.execute(text("UPDATE aaces.organizaciones SET estatus = 'activa' WHERE id = :id"), {"id": org_id})
    await conn.execute(
        text(
            "INSERT INTO aaces.usuarios (id, nombre, correo, password_hash, rol, activo, organizacion_id, intentos_fallidos, bloqueado_hasta) VALUES (gen_random_uuid(), 'Administrador', 'admin@aaces.com', :ph, 'admin', true, :org_id, 0, NULL)"
        ),
        {"ph": ph, "org_id": org_id},
    )
    logger.info("Admin recreated successfully with new UUID")
