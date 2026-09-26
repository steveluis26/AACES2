from __future__ import annotations
import logging
import os
import uuid
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

logger = logging.getLogger(__name__)


async def ensure_seed_data(conn: AsyncConnection, hash_password_fn) -> None:
    """Idempotent seed: platform user + demo org/admin. Safe to run multiple times."""
    logger.info("Starting idempotent seed...")

    # 1. Ensure plans exist (existing logic)
    await _ensure_plans(conn)

    # 2. Platform user (super_admin) - env-driven
    platform_user_id = await _ensure_platform_user(conn, hash_password_fn)

    # 3. Demo organization + admin user - RFC-based, idempotent
    demo_org_id = await _ensure_demo_org_and_admin(conn, hash_password_fn, platform_user_id)

    logger.info(f"Seed completed: platform_user_id={platform_user_id}, demo_org_id={demo_org_id}")


async def _ensure_plans(conn: AsyncConnection) -> None:
    res = await conn.execute(text("SELECT COUNT(*) FROM aaces.planes"))
    if int(res.scalar() or 0) > 0:
        return

    await conn.execute(
        text("""
            INSERT INTO aaces.planes (id, codigo, nombre, descripcion, precio_mensual, cursos_max, usuarios_max, constancias_max, incluye_soporte_prioritario, activo)
            VALUES (gen_random_uuid(), 'trial', 'Prueba', 'Prueba AACES gratis con 50 constancias', 0, 10, NULL, 50, false, true)
        """)
    )
    await conn.execute(
        text("""
            INSERT INTO aaces.planes (id, codigo, nombre, descripcion, precio_mensual, cursos_max, usuarios_max, constancias_max, incluye_marketplace, incluye_api, incluye_white_label, incluye_soporte_prioritario, activo)
            VALUES (gen_random_uuid(), 'profesional', 'Profesional', 'Para agencias capacitadoras en crecimiento', 499, 999999, NULL, 500, true, true, true, true, true)
        """)
    )
    await conn.execute(
        text("""
            INSERT INTO aaces.planes (id, codigo, nombre, descripcion, precio_mensual, cursos_max, usuarios_max, constancias_max, incluye_marketplace, incluye_api, incluye_white_label, incluye_soporte_prioritario, activo)
            VALUES (gen_random_uuid(), 'empresa', 'Empresa', 'Para agencias con muchos grupos al mes', 1299, 999999, NULL, 2000, true, true, true, true, true)
        """)
    )
    # Precio anual = 11 meses (un mes gratis)
    await conn.execute(text("UPDATE aaces.planes SET precio_anual = precio_mensual * 11 WHERE precio_anual IS NULL"))
    logger.info("Default plans seeded successfully")


async def _ensure_platform_user(conn: AsyncConnection, hash_password_fn) -> uuid.UUID:
    """
    Upsert platform user (super_admin) in usuarios_plataforma.
    Idempotent by email: returns existing UUID on re-run.
    """
    email = os.getenv("PLATFORM_USER_EMAIL", "admin@aaces.com")
    password = os.getenv("PLATFORM_USER_PASSWORD", "supersecurepassword123")
    name = os.getenv("PLATFORM_USER_NAME", "Super Admin")

    ph = hash_password_fn(password)

    # Check if platform user already exists
    existing = await conn.execute(
        text("SELECT id FROM aaces.usuarios_plataforma WHERE correo = :email"),
        {"email": email}
    )
    existing_id = existing.scalar()
    if existing_id:
        logger.info(f"Platform user already exists: {existing_id}")
        # No reescribir el hash en reinicios ordinarios: solo actualizar
        # nombre/estado y limpiar bloqueo. El password solo se fija al crear,
        # o si PLATFORM_FORCE_PASSWORD_RESET=true (rotacion explicita).
        if os.getenv("PLATFORM_FORCE_PASSWORD_RESET", "").lower() == "true":
            await conn.execute(
                text("""
                    UPDATE aaces.usuarios_plataforma
                    SET password_hash = :ph, nombre = :name, activo = true, fecha_actualizacion = now(),
                        intentos_fallidos = 0, bloqueado_hasta = NULL
                    WHERE correo = :email
                """),
                {"ph": ph, "name": name, "email": email}
            )
            logger.info("Platform user password force-rotated via PLATFORM_FORCE_PASSWORD_RESET")
        else:
            await conn.execute(
                text("""
                    UPDATE aaces.usuarios_plataforma
                    SET nombre = :name, activo = true, fecha_actualizacion = now(),
                        intentos_fallidos = 0, bloqueado_hasta = NULL
                    WHERE correo = :email
                """),
                {"name": name, "email": email}
            )
        return existing_id

    # Create new platform user
    result = await conn.execute(
        text("""
            INSERT INTO aaces.usuarios_plataforma (correo, nombre, password_hash, rol, activo)
            VALUES (:email, :name, :ph, 'super_admin', true)
            RETURNING id
        """),
        {"email": email, "name": name, "ph": ph}
    )
    new_id = result.scalar()
    logger.info(f"Created platform user: {new_id} ({email})")
    return new_id


async def _ensure_demo_org_and_admin(conn: AsyncConnection, hash_password_fn, platform_user_id: uuid.UUID) -> uuid.UUID:
    """
    Upsert demo organization + admin user in usuarios.
    Idempotent by RFC for org, by (organizacion_id, correo) for user.
    Returns org_id.
    """
    rfc = os.getenv("DEMO_ORG_RFC", "AAC123456789")
    org_name = os.getenv("DEMO_ORG_NAME", "AACES Demo")
    admin_email = os.getenv("DEMO_ORG_ADMIN_EMAIL", "admin@demo.com")
    admin_password = os.getenv("DEMO_ORG_ADMIN_PASSWORD", "demo123")
    admin_name = os.getenv("DEMO_ADMIN_NAME", "Administrador")

    ph = hash_password_fn(admin_password)

    # 1. Upsert organization by RFC (idempotent)
    org_res = await conn.execute(
        text("""
            INSERT INTO aaces.organizaciones (rfc, razon_social, nombre_comercial, email_contacto, estado, ciudad, estatus, fecha_activacion)
            VALUES (:rfc, :razon_social, :nombre_comercial, :email_contacto, 'CDMX', 'Ciudad de México', 'activa', now())
            ON CONFLICT (rfc) DO UPDATE SET
                razon_social = EXCLUDED.razon_social,
                nombre_comercial = EXCLUDED.nombre_comercial,
                email_contacto = EXCLUDED.email_contacto,
                estatus = 'activa',
                fecha_activacion = COALESCE(aaces.organizaciones.fecha_activacion, now())
            RETURNING id
        """),
        {
            "rfc": rfc,
            "razon_social": org_name,
            "nombre_comercial": org_name,
            "email_contacto": admin_email,
        }
    )
    org_id = org_res.scalar()
    logger.info(f"Demo organization upserted: {org_id} (RFC: {rfc})")

    # 2. Upsert admin user in usuarios (idempotent by UNIQUE(organizacion_id, correo)).
    # El password solo se fija al crear el usuario; en reinicios posteriores no
    # se reescribe (antes cada deploy revertia cambios hechos desde la app).
    # Rotacion explicita con DEMO_FORCE_PASSWORD_RESET=true.
    force_reset = os.getenv("DEMO_FORCE_PASSWORD_RESET", "").lower() == "true"
    if force_reset:
        admin_res = await conn.execute(
            text("""
                INSERT INTO aaces.usuarios (organizacion_id, correo, nombre, password_hash, rol, activo)
                VALUES (:org_id, :email, :name, :ph, 'admin', true)
                ON CONFLICT (organizacion_id, correo) DO UPDATE SET
                    password_hash = EXCLUDED.password_hash,
                    nombre = EXCLUDED.nombre,
                    rol = EXCLUDED.rol,
                    activo = true,
                    fecha_actualizacion = now(),
                    intentos_fallidos = 0,
                    bloqueado_hasta = NULL
                RETURNING id
            """),
            {"org_id": org_id, "email": admin_email, "name": admin_name, "ph": ph}
        )
        logger.info("Demo admin password force-rotated via DEMO_FORCE_PASSWORD_RESET")
    else:
        admin_res = await conn.execute(
            text("""
                INSERT INTO aaces.usuarios (organizacion_id, correo, nombre, password_hash, rol, activo)
                VALUES (:org_id, :email, :name, :ph, 'admin', true)
                ON CONFLICT (organizacion_id, correo) DO UPDATE SET
                    nombre = EXCLUDED.nombre,
                    rol = EXCLUDED.rol,
                    activo = true,
                    fecha_actualizacion = now(),
                    intentos_fallidos = 0,
                    bloqueado_hasta = NULL
                RETURNING id
            """),
            {"org_id": org_id, "email": admin_email, "name": admin_name, "ph": ph}
        )
    admin_id = admin_res.scalar()
    logger.info(f"Demo admin upserted: {admin_id} ({admin_email})")

    # 3. Ensure trial subscription exists for this org
    plan_res = await conn.execute(
        text("SELECT id FROM aaces.planes WHERE codigo = 'trial' AND activo = true LIMIT 1")
    )
    plan_id = plan_res.scalar()
    if plan_id:
        await conn.execute(
            text("""
                INSERT INTO aaces.suscripciones (organizacion_id, plan_id, estatus, fecha_inicio, activada_por)
                SELECT :org_id, :plan_id, 'activa', CURRENT_DATE, :admin_id
                WHERE NOT EXISTS (SELECT 1 FROM aaces.suscripciones WHERE organizacion_id = :org_id)
            """),
            {"org_id": org_id, "plan_id": plan_id, "admin_id": admin_id}
        )
        logger.info(f"Trial subscription ensured for org {org_id}")

    return org_id