#!/usr/bin/env python3
"""
Script de exploración de base de datos para AACES
Permite explorar usuarios, tablas y datos de forma interactiva
"""

import asyncio
import os
import sys
from datetime import datetime
from sqlalchemy import text, select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker
from app.db.database import get_db, engine, Base
from app.models.cliente import Cliente
from app.models.emprendimiento import Emprendimiento
from app.models.pago import Pago
from app.models.suscripcion import Suscripcion
from app.core.security import get_password_hash, verify_password

# Colores para output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    PURPLE = '\033[95m'
    CYAN = '\033[96m'
    WHITE = '\033[97m'
    ENDC = '\033[0m'

async def test_connection():
    """Prueba la conexión a la base de datos"""
    try:
        async with engine.begin() as conn:
            result = await conn.execute(text("SELECT version()"))
            version = result.scalar()
            print(f"{Colors.GREEN}✅ Conexión exitosa a PostgreSQL{Colors.ENDC}")
            print(f"{Colors.CYAN}Versión: {version}{Colors.ENDC}")
            return True
    except Exception as e:
        print(f"{Colors.RED}❌ Error de conexión: {e}{Colors.ENDC}")
        return False

async def show_tables():
    """Muestra todas las tablas en la base de datos"""
    try:
        async with engine.begin() as conn:
            result = await conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                ORDER BY table_name
            """))
            tables = result.fetchall()
            
            print(f"\n{Colors.PURPLE}📊 Tablas en la base de datos:{Colors.ENDC}")
            for table in tables:
                table_name = table[0]
                # Contar registros
                count_result = await conn.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
                count = count_result.scalar()
                print(f"  {Colors.BLUE}•{Colors.ENDC} {table_name}: {Colors.YELLOW}{count} registros{Colors.ENDC}")
            
            return tables
    except Exception as e:
        print(f"{Colors.RED}Error al mostrar tablas: {e}{Colors.ENDC}")
        return []

async def show_users():
    """Muestra todos los usuarios registrados"""
    try:
        async with AsyncSession(engine) as session:
            result = await session.execute(
                select(Cliente).order_by(Cliente.created_at.desc())
            )
            users = result.scalars().all()
            
            if not users:
                print(f"\n{Colors.YELLOW}⚠️  No hay usuarios registrados{Colors.ENDC}")
                return
            
            print(f"\n{Colors.PURPLE}👥 Usuarios registrados ({len(users)}):{Colors.ENDC}")
            for user in users:
                status = f"{Colors.GREEN}✅ Activo{Colors.ENDC}" if user.activo else f"{Colors.RED}❌ Inactivo{Colors.ENDC}"
                verified = f"{Colors.GREEN}✅ Verificado{Colors.ENDC}" if user.email_verificado else f"{Colors.RED}❌ No verificado{Colors.ENDC}"
                
                print(f"\n  {Colors.BLUE}ID:{Colors.ENDC} {user.id}")
                print(f"  {Colors.BLUE}Email:{Colors.ENDC} {user.email}")
                print(f"  {Colors.BLUE}Nombre:{Colors.ENDC} {user.nombre} {user.apellido}")
                print(f"  {Colors.BLUE}Rol:{Colors.ENDC} {user.rol}")
                print(f"  {Colors.BLUE}Estado:{Colors.ENDC} {status}")
                print(f"  {Colors.BLUE}Email verificado:{Colors.ENDC} {verified}")
                print(f"  {Colors.BLUE}Creado:{Colors.ENDC} {user.created_at}")
                print(f"  {Colors.BLUE}Contraseña hash:{Colors.ENDC} {user.contrasena[:50]}...")
                
    except Exception as e:
        print(f"{Colors.RED}Error al mostrar usuarios: {e}{Colors.ENDC}")

async def check_specific_users():
    """Verifica usuarios específicos de prueba"""
    try:
        async with AsyncSession(engine) as session:
            test_emails = ["admin@aaces.com", "cliente1@example.com"]
            
            print(f"\n{Colors.PURPLE}🔍 Verificando usuarios de prueba:{Colors.ENDC}")
            
            for email in test_emails:
                result = await session.execute(
                    select(Cliente).where(Cliente.email == email)
                )
                user = result.scalar_one_or_none()
                
                if user:
                    print(f"\n  {Colors.GREEN}✅ {email} encontrado:{Colors.ENDC}")
                    print(f"    ID: {user.id}")
                    print(f"    Nombre: {user.nombre} {user.apellido}")
                    print(f"    Rol: {user.rol}")
                    print(f"    Activo: {user.activo}")
                    print(f"    Email verificado: {user.email_verificado}")
                else:
                    print(f"  {Colors.RED}❌ {email} no encontrado{Colors.ENDC}")
                    
    except Exception as e:
        print(f"{Colors.RED}Error al verificar usuarios: {e}{Colors.ENDC}")

async def create_test_users():
    """Crea usuarios de prueba si no existen"""
    try:
        async with AsyncSession(engine) as session:
            # Verificar admin@aaces.com
            result = await session.execute(
                select(Cliente).where(Cliente.email == "admin@aaces.com")
            )
            admin_user = result.scalar_one_or_none()
            
            if not admin_user:
                print(f"{Colors.YELLOW}Creando usuario admin@aaces.com...{Colors.ENDC}")
                admin = Cliente(
                    email="admin@aaces.com",
                    nombre="Admin",
                    apellido="AACES",
                    contrasena=get_password_hash("admin123"),
                    rol="admin",
                    activo=True,
                    email_verificado=True,
                    created_at=datetime.utcnow()
                )
                session.add(admin)
                await session.commit()
                print(f"{Colors.GREEN}✅ Usuario admin@aaces.com creado{Colors.ENDC}")
            
            # Verificar cliente1@example.com
            result = await session.execute(
                select(Cliente).where(Cliente.email == "cliente1@example.com")
            )
            cliente_user = result.scalar_one_or_none()
            
            if not cliente_user:
                print(f"{Colors.YELLOW}Creando usuario cliente1@example.com...{Colors.ENDC}")
                cliente = Cliente(
                    email="cliente1@example.com",
                    nombre="Cliente",
                    apellido="Prueba",
                    contrasena=get_password_hash("cliente123"),
                    rol="cliente",
                    activo=True,
                    email_verificado=True,
                    created_at=datetime.utcnow()
                )
                session.add(cliente)
                await session.commit()
                print(f"{Colors.GREEN}✅ Usuario cliente1@example.com creado{Colors.ENDC}")
                
    except Exception as e:
        print(f"{Colors.RED}Error al crear usuarios: {e}{Colors.ENDC}")

async def test_password():
    """Prueba la verificación de contraseñas"""
    try:
        async with AsyncSession(engine) as session:
            # Probar con admin
            result = await session.execute(
                select(Cliente).where(Cliente.email == "admin@aaces.com")
            )
            admin_user = result.scalar_one_or_none()
            
            if admin_user:
                print(f"\n{Colors.PURPLE}🔐 Prueba de contraseñas:{Colors.ENDC}")
                
                # Verificar contraseña correcta
                is_valid = verify_password("admin123", admin_user.contrasena)
                print(f"  Contraseña 'admin123': {Colors.GREEN if is_valid else Colors.RED}{'✅ Válida' if is_valid else '❌ Inválida'}{Colors.ENDC}")
                
                # Verificar contraseña incorrecta
                is_valid = verify_password("wrongpass", admin_user.contrasena)
                print(f"  Contraseña 'wrongpass': {Colors.GREEN if not is_valid else Colors.RED}{'✅ Inválida' if not is_valid else '❌ Válida'}{Colors.ENDC}")
                
    except Exception as e:
        print(f"{Colors.RED}Error al probar contraseñas: {e}{Colors.ENDC}")

async def show_database_info():
    """Muestra información detallada de la base de datos"""
    try:
        async with engine.begin() as conn:
            # Tamaño de la base de datos
            result = await conn.execute(text("""
                SELECT pg_database_size(current_database())
            """))
            db_size = result.scalar()
            
            # Versión
            result = await conn.execute(text("SELECT version()"))
            version = result.scalar()
            
            print(f"\n{Colors.PURPLE}📈 Información de la base de datos:{Colors.ENDC}")
            print(f"  {Colors.BLUE}Tamaño:{Colors.ENDC} {db_size / 1024 / 1024:.2f} MB")
            print(f"  {Colors.BLUE}Versión:{Colors.ENDC} {version.split('(')[0]}")
            
    except Exception as e:
        print(f"{Colors.RED}Error al obtener info de BD: {e}{Colors.ENDC}")

async def main():
    """Función principal"""
    print(f"{Colors.CYAN}{'='*60}{Colors.ENDC}")
    print(f"{Colors.CYAN}🚀 EXPLORADOR DE BASE DE DATOS AACES{Colors.ENDC}")
    print(f"{Colors.CYAN}{'='*60}{Colors.ENDC}")
    
    # Verificar conexión
    if not await test_connection():
        return
    
    # Mostrar información de la BD
    await show_database_info()
    
    # Mostrar tablas
    await show_tables()
    
    # Mostrar usuarios
    await show_users()
    
    # Verificar usuarios específicos
    await check_specific_users()
    
    # Crear usuarios de prueba si no existen
    await create_test_users()
    
    # Probar contraseñas
    await test_password()
    
    print(f"\n{Colors.GREEN}✅ Exploración completada{Colors.ENDC}")
    print(f"\n{Colors.CYAN}Puedes ejecutar este script nuevamente para verificar cambios{Colors.ENDC}")

if __name__ == "__main__":
    # Agregar el directorio raíz del proyecto al path
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    
    asyncio.run(main())