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
    
    # Check if admin exists in usuarios (new schema)
    res = await conn.execute(text("SELECT id FROM aaces.usuarios WHERE correo = 'admin@aaces.com'"))
    existing_id = res.scalar()
    
    if existing_id and str(existing_id) == PROBLEM_ID:
        logger.info(f"Admin has problematic ID {PROBLEM_ID}, deleting and recreating with new UUID...")
        # Clear FK references first
        await conn.execute(text("UPDATE aaces.plantillas SET creada_por = NULL WHERE creada_por = :id"), {"id": existing_id})
        await conn.execute(text("DELETE FROM aaces.usuarios WHERE id = :id"), {"id": existing_id})
        await conn.execute(text("DELETE FROM aaces.clientes WHERE correo = 'admin@aaces.com'"))
        existing_id = None
    elif existing_id:
        logger.info("Admin already exists in usuarios with valid ID")
        return
    
    # Check if admin exists in clientes (old schema) - migrate it with NEW UUID
    res = await conn.execute(text("SELECT nombre, correo, password_hash, categoria, estado, organizacion_id FROM aaces.clientes WHERE correo = 'admin@aaces.com'"))
    row = res.fetchone()
    if row is not None:
        logger.info("Migrating existing admin from clientes to usuarios with new UUID...")
        org_id = row[5]
        if org_id is None:
            org_res = await conn.execute(text("INSERT INTO aaces.organizaciones (id, rfc, razon_social, estatus) VALUES (gen_random_uuid(), 'AAC123456789', 'AACES Demo', 'activa') RETURNING id"))
            org_id = org_res.scalar()
        
        await conn.execute(
            text(
                "INSERT INTO aaces.usuarios (id, nombre, correo, password_hash, rol, activo, organizacion_id, intentos_fallidos, bloqueado_hasta) VALUES (gen_random_uuid(), :nombre, :correo, :ph, 'admin', true, :org_id, 0, NULL)"
            ),
            {"nombre": row[0], "correo": row[1], "ph": row[2], "org_id": org_id},
        )
        logger.info("Admin migrated successfully from clientes to usuarios with new UUID")
        return
    
    logger.info("No users found, seeding admin in usuarios...")
    ph = hash_password_fn("admin123")
    org_res = await conn.execute(text("INSERT INTO aaces.organizaciones (id, rfc, razon_social, estatus) VALUES (gen_random_uuid(), 'AAC123456789', 'AACES Demo', 'activa') RETURNING id"))
    org_id = org_res.scalar()
    await conn.execute(
        text(
            "INSERT INTO aaces.usuarios (id, nombre, correo, password_hash, rol, activo, organizacion_id, intentos_fallidos, bloqueado_hasta) VALUES (gen_random_uuid(), 'Administrador', 'admin@aaces.com', :ph, 'admin', true, :org_id, 0, NULL)"
        ),
        {"ph": ph, "org_id": org_id},
    )
    logger.info("Admin seeded successfully in usuarios")
