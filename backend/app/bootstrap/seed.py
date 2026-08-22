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
    
    # NUCLEAR: Delete ALL users with admin email in both tables, then recreate
    logger.info("Nuclear cleanup: deleting any admin@aaces.com from usuarios and clientes...")
    # Also delete by the known problematic ID directly
    await conn.execute(text("UPDATE aaces.plantillas SET creada_por = NULL WHERE creada_por = '73d2bb00-cde6-4255-bd27-d1282c4e83ff'"))
    await conn.execute(text("UPDATE aaces.documentos_emitidos SET emitido_por = NULL WHERE emitido_por = '73d2bb00-cde6-4255-bd27-d1282c4e83ff'"))
    await conn.execute(text("DELETE FROM aaces.usuarios WHERE id = '73d2bb00-cde6-4255-bd27-d1282c4e83ff'"))
    await conn.execute(text("DELETE FROM aaces.clientes WHERE id = '73d2bb00-cde6-4255-bd27-d1282c4e83ff'"))
    await conn.execute(text("UPDATE aaces.plantillas SET creada_por = NULL WHERE creada_por IN (SELECT id FROM aaces.usuarios WHERE correo ILIKE 'admin@aaces.com')"))
    await conn.execute(text("UPDATE aaces.documentos_emitidos SET emitido_por = NULL WHERE emitido_por IN (SELECT id FROM aaces.usuarios WHERE correo ILIKE 'admin@aaces.com')"))
    result_usuarios = await conn.execute(text("DELETE FROM aaces.usuarios WHERE correo ILIKE 'admin@aaces.com'"))
    result_clientes = await conn.execute(text("DELETE FROM aaces.clientes WHERE correo ILIKE 'admin@aaces.com'"))
    logger.info(f"Nuclear cleanup done: usuarios deleted={result_usuarios.rowcount}, clientes deleted={result_clientes.rowcount}")
    
    # Create fresh admin with new UUID
    ph = hash_password_fn("admin123")
    org_res = await conn.execute(text("INSERT INTO aaces.organizaciones (id, rfc, razon_social, estatus) VALUES (gen_random_uuid(), 'AAC123456789', 'AACES Demo', 'activa') RETURNING id"))
    org_id = org_res.scalar()
    await conn.execute(
        text(
            "INSERT INTO aaces.usuarios (id, nombre, correo, password_hash, rol, activo, organizacion_id, intentos_fallidos, bloqueado_hasta) VALUES (gen_random_uuid(), 'Administrador', 'admin@aaces.com', :ph, 'admin', true, :org_id, 0, NULL)"
        ),
        {"ph": ph, "org_id": org_id},
    )
    logger.info("Admin recreated successfully with new UUID")
