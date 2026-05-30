#!/usr/bin/env python3
"""
Script de diagnóstico completo para la base de datos AACES
Este script verifica la conexión y muestra información detallada de usuarios
"""

import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import json

def get_connection_info():
    """Obtiene información de conexión desde variables de entorno"""
    print("🔍 CONFIGURACIÓN DE BASE DE DATOS")
    print("=" * 50)
    
    # Intentar obtener de variables de entorno
    db_host = os.getenv('DB_HOST', 'localhost')
    db_port = os.getenv('DB_PORT', '5432')
    db_name = os.getenv('DB_NAME', 'aaces_db')
    db_user = os.getenv('DB_USER', 'postgres')
    db_password = os.getenv('DB_PASSWORD', '')
    
    print(f"Host: {db_host}")
    print(f"Puerto: {db_port}")
    print(f"Base de datos: {db_name}")
    print(f"Usuario: {db_user}")
    print(f"Contraseña: {'*' * len(db_password) if db_password else 'NO CONFIGURADA'}")
    
    # Construir URL de conexión
    if db_password:
        database_url = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
    else:
        database_url = f"postgresql://{db_user}@{db_host}:{db_port}/{db_name}"
    
    print(f"URL completa: {database_url}")
    return database_url

def test_connection():
    """Prueba la conexión a PostgreSQL"""
    print("\n🔍 PROBANDO CONEXIÓN A BASE DE DATOS")
    print("=" * 50)
    
    database_url = get_connection_info()
    
    try:
        # Prueba con psycopg2 directo
        print("Intentando conexión con psycopg2...")
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        version = cursor.fetchone()
        print(f"✅ PostgreSQL conectado: {version[0]}")
        
        # Prueba con SQLAlchemy
        print("\nIntentando conexión con SQLAlchemy...")
        engine = create_engine(database_url)
        with engine.connect() as connection:
            result = connection.execute(text("SELECT current_database(), current_user, now()"))
            db_info = result.fetchone()
            print(f"✅ Base de datos actual: {db_info[0]}")
            print(f"✅ Usuario actual: {db_info[1]}")
            print(f"✅ Fecha y hora del servidor: {db_info[2]}")
        
        return True, engine
        
    except Exception as e:
        print(f"❌ Error de conexión: {str(e)}")
        print(f"❌ Tipo de error: {type(e).__name__}")
        return False, None

def show_tables(engine):
    """Muestra todas las tablas en la base de datos"""
    print("\n📋 TABLAS EN LA BASE DE DATOS")
    print("=" * 50)
    
    try:
        with engine.connect() as connection:
            # Obtener tablas
            result = connection.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                ORDER BY table_name;
            """))
            tables = result.fetchall()
            
            if tables:
                print(f"📊 Se encontraron {len(tables)} tablas:")
                for table in tables:
                    table_name = table[0]
                    print(f"  - {table_name}")
                    
                    # Contar registros en cada tabla
                    try:
                        count_result = connection.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
                        count = count_result.fetchone()[0]
                        print(f"    └─ {count} registros")
                    except Exception as e:
                        print(f"    └─ Error al contar: {str(e)}")
            else:
                print("⚠️  No se encontraron tablas en la base de datos")
                
    except Exception as e:
        print(f"❌ Error al obtener tablas: {str(e)}")

def show_users(engine):
    """Muestra todos los usuarios registrados"""
    print("\n👥 USUARIOS REGISTRADOS")
    print("=" * 50)
    
    try:
        with engine.connect() as connection:
            result = connection.execute(text("""
                SELECT 
                    id,
                    email,
                    full_name,
                    user_type,
                    is_active,
                    created_at,
                    updated_at
                FROM users
                ORDER BY created_at DESC;
            """))
            users = result.fetchall()
            
            if users:
                print(f"👤 Se encontraron {len(users)} usuarios:")
                for user in users:
                    print(f"\n📝 Usuario ID: {user[0]}")
                    print(f"   Email: {user[1]}")
                    print(f"   Nombre: {user[2] or 'No especificado'}")
                    print(f"   Tipo: {user[3]}")
                    print(f"   Activo: {'✅ Sí' if user[4] else '❌ No'}")
                    print(f"   Creado: {user[5]}")
                    print(f"   Actualizado: {user[6]}")
            else:
                print("⚠️  No se encontraron usuarios en la base de datos")
                
    except Exception as e:
        print(f"❌ Error al obtener usuarios: {str(e)}")

def check_specific_users(engine):
    """Verifica usuarios específicos"""
    print("\n🔍 VERIFICANDO USUARIOS ESPECÍFICOS")
    print("=" * 50)
    
    test_users = [
        'admin@aaces.com',
        'cliente1@example.com',
        'test@example.com'
    ]
    
    try:
        with engine.connect() as connection:
            for email in test_users:
                result = connection.execute(
                    text("SELECT id, email, full_name, user_type, is_active, created_at FROM users WHERE email = :email"),
                    {"email": email}
                )
                user = result.fetchone()
                
                if user:
                    print(f"✅ {email} - ENCONTRADO:")
                    print(f"   ID: {user[0]}")
                    print(f"   Nombre: {user[2] or 'No especificado'}")
                    print(f"   Tipo: {user[3]}")
                    print(f"   Activo: {'Sí' if user[4] else 'No'}")
                    print(f"   Creado: {user[5]}")
                else:
                    print(f"❌ {email} - NO ENCONTRADO")
                    
    except Exception as e:
        print(f"❌ Error al verificar usuarios: {str(e)}")

def create_test_users(engine):
    """Crea usuarios de prueba si no existen"""
    print("\n🔧 CREANDO USUARIOS DE PRUEBA")
    print("=" * 50)
    
    try:
        with engine.connect() as connection:
            # Verificar si existe el usuario admin
            result = connection.execute(
                text("SELECT id FROM users WHERE email = 'admin@aaces.com'")
            )
            admin_exists = result.fetchone()
            
            if not admin_exists:
                print("Creando usuario admin@aaces.com...")
                # Hash de contraseña 'admin123'
                admin_password = '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW'
                
                connection.execute(
                    text("""
                        INSERT INTO users (email, hashed_password, full_name, user_type, is_active, created_at, updated_at)
                        VALUES (:email, :password, :full_name, :user_type, :is_active, :created_at, :updated_at)
                    """),
                    {
                        "email": "admin@aaces.com",
                        "password": admin_password,
                        "full_name": "Administrador AACES",
                        "user_type": "admin",
                        "is_active": True,
                        "created_at": datetime.now(),
                        "updated_at": datetime.now()
                    }
                )
                print("✅ Usuario admin@aaces.com creado")
                print("   Contraseña: admin123")
            else:
                print("✅ Usuario admin@aaces.com ya existe")
            
            # Verificar si existe el usuario cliente
            result = connection.execute(
                text("SELECT id FROM users WHERE email = 'cliente1@example.com'")
            )
            client_exists = result.fetchone()
            
            if not client_exists:
                print("Creando usuario cliente1@example.com...")
                # Hash de contraseña 'cliente123'
                client_password = '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW'
                
                connection.execute(
                    text("""
                        INSERT INTO users (email, hashed_password, full_name, user_type, is_active, created_at, updated_at)
                        VALUES (:email, :password, :full_name, :user_type, :is_active, :created_at, :updated_at)
                    """),
                    {
                        "email": "cliente1@example.com",
                        "password": client_password,
                        "full_name": "Cliente de Prueba",
                        "user_type": "cliente",
                        "is_active": True,
                        "created_at": datetime.now(),
                        "updated_at": datetime.now()
                    }
                )
                print("✅ Usuario cliente1@example.com creado")
                print("   Contraseña: cliente123")
            else:
                print("✅ Usuario cliente1@example.com ya existe")
                
    except Exception as e:
        print(f"❌ Error al crear usuarios de prueba: {str(e)}")

def show_database_schema(engine):
    """Muestra el esquema de la base de datos"""
    print("\n🏗️  ESQUEMA DE BASE DE DATOS")
    print("=" * 50)
    
    try:
        with engine.connect() as connection:
            # Obtener información de columnas de la tabla users
            result = connection.execute(text("""
                SELECT 
                    column_name,
                    data_type,
                    is_nullable,
                    column_default
                FROM information_schema.columns
                WHERE table_name = 'users'
                ORDER BY ordinal_position;
            """))
            columns = result.fetchall()
            
            if columns:
                print("📋 Estructura de la tabla 'users':")
                for col in columns:
                    print(f"  - {col[0]}: {col[1]} {'NULL' if col[2] == 'YES' else 'NOT NULL'} {'DEFAULT: ' + str(col[3]) if col[3] else ''}")
            else:
                print("⚠️  No se encontró la tabla 'users'")
                
    except Exception as e:
        print(f"❌ Error al obtener esquema: {str(e)}")

def main():
    """Función principal"""
    print("🚀 DIAGNÓSTICO COMPLETO DE BASE DE DATOS AACES")
    print("=" * 60)
    
    # Probar conexión
    connected, engine = test_connection()
    
    if connected:
        # Mostrar tablas
        show_tables(engine)
        
        # Mostrar esquema
        show_database_schema(engine)
        
        # Mostrar usuarios
        show_users(engine)
        
        # Verificar usuarios específicos
        check_specific_users(engine)
        
        # Crear usuarios de prueba si no existen
        create_test_users(engine)
        
        # Mostrar usuarios actualizados
        show_users(engine)
        
        print("\n✅ Diagnóstico completado")
        print("\n📋 RESUMEN DE CREDENCIALES DE PRUEBA:")
        print("   Admin: admin@aaces.com / admin123")
        print("   Cliente: cliente1@example.com / cliente123")
        
    else:
        print("\n❌ No se pudo conectar a la base de datos")
        print("\n🔧 SUGERENCIAS:")
        print("   1. Verifica que PostgreSQL esté ejecutándose")
        print("   2. Verifica las credenciales en el archivo .env")
        print("   3. Asegúrate de que la base de datos 'aaces_db' exista")
        print("   4. Verifica el archivo docker-compose.yml para la configuración")

if __name__ == "__main__":
    main()