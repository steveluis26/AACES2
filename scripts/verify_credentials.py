#!/usr/bin/env python3
"""
Script para verificar y crear credenciales de prueba en la base de datos
"""

import sys
import os
sys.path.append('/Users/riquer/Documents/trae_projects/AACES/backend')

import asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select
from app.core.database import Base
from app.models import Cliente
from app.core.security import get_password_hash
from app.core.config import settings
import uuid

# Configuración de la base de datos
DATABASE_URL = settings.DATABASE_URL

engine = create_async_engine(DATABASE_URL, echo=True)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def create_test_users():
    """Crear usuarios de prueba"""
    async with AsyncSessionLocal() as session:
        try:
            # Verificar si el admin existe
            result = await session.execute(
                select(Cliente).where(Cliente.email == "admin@aaces.com")
            )
            admin_user = result.scalar_one_or_none()
            
            if not admin_user:
                # Crear usuario admin
                admin_user = Cliente(
                    id=str(uuid.uuid4()),
                    nombre="Administrador",
                    email="admin@aaces.com",
                    hashed_password=get_password_hash("admin123"),
                    rol="admin",
                    telefono="+1234567890",
                    direccion="Dirección Admin",
                    ciudad="Ciudad Admin",
                    pais="País Admin",
                    codigo_postal="12345",
                    fecha_nacimiento="1990-01-01",
                    genero="otro",
                    estado_civil="soltero",
                    profesion="Administrador",
                    ingresos_mensuales=5000.0,
                    tipo_vivienda="propia",
                    activo=True,
                    verificado=True
                )
                session.add(admin_user)
                print("✅ Usuario admin creado")
            else:
                print("ℹ️ Usuario admin ya existe")

            # Verificar si el cliente existe
            result = await session.execute(
                select(Cliente).where(Cliente.email == "cliente1@example.com")
            )
            client_user = result.scalar_one_or_none()
            
            if not client_user:
                # Crear usuario cliente
                client_user = Cliente(
                    id=str(uuid.uuid4()),
                    nombre="Cliente de Prueba",
                    email="cliente1@example.com",
                    hashed_password=get_password_hash("cliente123"),
                    rol="cliente",
                    telefono="+0987654321",
                    direccion="Dirección Cliente",
                    ciudad="Ciudad Cliente",
                    pais="País Cliente",
                    codigo_postal="54321",
                    fecha_nacimiento="1985-05-15",
                    genero="masculino",
                    estado_civil="casado",
                    profesion="Ingeniero",
                    ingresos_mensuales=3000.0,
                    tipo_vivienda="alquiler",
                    activo=True,
                    verificado=True
                )
                session.add(client_user)
                print("✅ Usuario cliente creado")
            else:
                print("ℹ️ Usuario cliente ya existe")

            await session.commit()
            print("✅ Base de datos actualizada con usuarios de prueba")
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Error al crear usuarios: {e}")
            raise

async def verify_users():
    """Verificar que los usuarios existen"""
    async with AsyncSessionLocal() as session:
        try:
            # Verificar admin
            result = await session.execute(
                select(Cliente).where(Cliente.email == "admin@aaces.com")
            )
            admin_user = result.scalar_one_or_none()
            
            if admin_user:
                print(f"✅ Admin encontrado: {admin_user.email} (Rol: {admin_user.rol})")
            else:
                print("❌ Admin no encontrado")

            # Verificar cliente
            result = await session.execute(
                select(Cliente).where(Cliente.email == "cliente1@example.com")
            )
            client_user = result.scalar_one_or_none()
            
            if client_user:
                print(f"✅ Cliente encontrado: {client_user.email} (Rol: {client_user.rol})")
            else:
                print("❌ Cliente no encontrado")
                
        except Exception as e:
            print(f"❌ Error al verificar usuarios: {e}")
            raise

if __name__ == "__main__":
    print("🔍 Verificando y creando usuarios de prueba...")
    asyncio.run(create_test_users())
    asyncio.run(verify_users())
    print("✅ Proceso completado")