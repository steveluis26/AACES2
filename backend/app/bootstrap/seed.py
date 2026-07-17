from __future__ import annotations
import logging
import uuid
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

logger = logging.getLogger(__name__)


async def ensure_seed_data(conn: AsyncConnection, hash_password_fn) -> None:
    try:
        async with conn.begin_nested():
            await _ensure_plans(conn)
    except Exception as e:
        logger.warning(f"Failed to seed plans: {e}")
    try:
        async with conn.begin_nested():
            await _ensure_admin(conn, hash_password_fn)
    except Exception as e:
        logger.warning(f"Failed to seed admin: {e}")


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
    res = await conn.execute(text("SELECT COUNT(*) FROM aaces.clientes"))
    if int(res.scalar() or 0) > 0:
        return

    logger.info("No users found, seeding admin...")
    ph = hash_password_fn("admin123")
    await conn.execute(
        text(
            "INSERT INTO aaces.clientes (id, nombre, correo, password_hash, categoria, estado, acepta_terminos, plan, cursos_max, cursos_creados, descuento_pct) VALUES (:id, :nombre, :correo, :ph, 'enterprise', 'activo', true, 'ilimitado', 999999, 0, 0)"
        ),
        {"id": str(uuid.uuid4()), "nombre": "Administrador", "correo": "admin@aaces.com", "ph": ph},
    )
    logger.info("Admin seeded successfully")
