#!/usr/bin/env python3
"""
Script de migración: Convierte registros existentes de clientes
en el nuevo esquema: organizaciones + usuarios + suscripciones.

Uso: python -m scripts.migrate_clientes [--dry-run]
"""

import os
import sys
import uuid
import argparse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/aaces_db")

import asyncio
from sqlalchemy import text
from app.core.database import engine, AsyncSessionLocal
from app.services.security import security_service
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("migrate_clientes")

PLAN_MAP = {
    "trial": "trial",
    "basico": "profesional",
    "premium": "profesional",
    "enterprise": "empresa",
    "ilimitado": "empresa",
}

async def migrate(dry_run: bool = False):
    async with AsyncSessionLocal() as db:
        await db.execute(text("SET LOCAL search_path TO aaces"))

        clientes = await db.execute(
            text("""
                SELECT c.id, c.nombre, c.correo, c.password_hash, c.ciudad_base,
                       COALESCE(c.plan, 'trial') as plan, c.cursos_max, c.cursos_creados,
                       c.descuento_pct, c.categoria, c.estado, c.vigencia_desde,
                       c.vigencia_hasta, c.fecha_creacion, c.acepta_terminos,
                       c.must_change_password
                FROM aaces.clientes c
                WHERE c.organizacion_id IS NULL
                ORDER BY c.fecha_creacion
            """)
        )
        rows = clientes.fetchall()
        logger.info(f"Found {len(rows)} clientes to migrate")

        if dry_run:
            for r in rows:
                logger.info(f"  Would migrate: {r[1]} <{r[2]}> plan={r[5]}")
            return

        planes = await db.execute(text("SELECT id, codigo FROM aaces.planes"))
        plan_map_db = {row[1]: row[0] for row in planes.fetchall()}

        migrated = 0
        errors = 0

        for r in rows:
            cid = str(r[0])
            nombre = r[1] or "Sin nombre"
            correo = r[2]
            password_hash = r[3]
            ciudad_base = r[4] or ""
            plan_old = r[5] or "trial"
            cursos_max = r[6] or 10
            # cursos_creados = r[7] or 0
            # descuento_pct = r[8] or 0
            categoria = r[9] or "basico"
            estado = r[10] or "activo"
            vigencia_desde = r[11]
            vigencia_hasta = r[12]
            fecha_creacion = r[13]
            # acepta_terminos = r[14] or False
            # must_change_password = r[15] or False

            try:
                org_id = str(uuid.uuid4())
                rfc_placeholder = f"MIG-{cid[:8].upper()}"

                if "@" in correo:
                    email_local = correo.split("@")[0]
                    email_domain = correo.split("@")[1]
                    email_contacto = correo
                else:
                    email_contacto = f"migrado-{cid[:8]}@aaces.com"

                razon_social = f"{nombre}" + (f" ({ciudad_base})" if ciudad_base else "")

                org_estatus = "activa" if estado == "activo" and vigencia_hasta is not None else ("pendiente" if estado == "activo" else "suspendida")

                await db.execute(
                    text("""
                        INSERT INTO aaces.organizaciones (id, rfc, razon_social, nombre_comercial, email_contacto, ciudad, estatus, fecha_creacion, fecha_activacion)
                        VALUES (:id, :rfc, :razon_social, :nombre_comercial, :email, :ciudad, :estatus, :fecha_creacion, CASE WHEN :estatus = 'activa' THEN now() ELSE NULL END)
                    """),
                    {
                        "id": org_id, "rfc": rfc_placeholder, "razon_social": razon_social,
                        "nombre_comercial": nombre, "email": email_contacto,
                        "ciudad": ciudad_base, "estatus": org_estatus,
                        "fecha_creacion": fecha_creacion,
                    }
                )

                user_id = str(uuid.uuid4())
                rol = "admin"
                if correo in ("admin@aaces.com", "administrator@aaces.com", "superadmin@aaces.com"):
                    rol = "admin"

                await db.execute(
                    text("""
                        INSERT INTO aaces.usuarios (id, organizacion_id, nombre, correo, password_hash, rol, activo, fecha_creacion)
                        VALUES (:id, :org_id, :nombre, :correo, :password_hash, :rol, true, :fecha_creacion)
                    """),
                    {
                        "id": user_id, "org_id": org_id, "nombre": nombre,
                        "correo": correo, "password_hash": password_hash,
                        "rol": rol, "fecha_creacion": fecha_creacion,
                    }
                )

                plan_code = PLAN_MAP.get(plan_old, "trial")
                plan_id = plan_map_db.get(plan_code)
                if not plan_id:
                    fallback = await db.execute(text("SELECT id FROM aaces.planes WHERE codigo = 'trial' LIMIT 1"))
                    plan_id = fallback.scalar()

                suscripcion_estatus = "activa" if org_estatus == "activa" else "pendiente"
                await db.execute(
                    text("""
                        INSERT INTO aaces.suscripciones (organizacion_id, plan_id, estatus, fecha_inicio, fecha_fin, cursos_max)
                        VALUES (:org_id, :plan_id, :estatus, :fecha_inicio, :fecha_fin, :cursos_max)
                    """),
                    {
                        "org_id": org_id, "plan_id": plan_id, "estatus": suscripcion_estatus,
                        "fecha_inicio": vigencia_desde, "fecha_fin": vigencia_hasta,
                        "cursos_max": cursos_max,
                    }
                )

                await db.execute(
                    text("UPDATE aaces.clientes SET organizacion_id = :org_id WHERE id = :cid"),
                    {"org_id": org_id, "cid": cid}
                )

                migrated += 1
                logger.info(f"  OK: {nombre} <{correo}> → org={org_id[:8]} plan={plan_code}")

            except Exception as e:
                errors += 1
                logger.error(f"  ERROR migrating {nombre} <{correo}>: {e}")
                await db.rollback()

        if migrated > 0 or errors > 0:
            await db.commit()

        logger.info(f"Migration complete: {migrated} migrated, {errors} errors")

async def main():
    parser = argparse.ArgumentParser(description="Migrate clientes to new schema")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be migrated without making changes")
    args = parser.parse_args()

    if args.dry_run:
        logger.info("DRY RUN - no changes will be made")
    await migrate(dry_run=args.dry_run)

if __name__ == "__main__":
    asyncio.run(main())
