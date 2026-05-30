#!/usr/bin/env python3
"""
Script de diagnóstico completo para PostgreSQL
Proporciona acceso total a la base de datos y verificación de conectividad
"""

import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
import json
from urllib.parse import urlparse
import hashlib

def get_database_config():
    """Obtiene configuración de base de datos desde variables de entorno"""
    database_url = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/aaces_db')
    
    if database_url:
        parsed = urlparse(database_url)
        return {
            'host': parsed.hostname or 'localhost',
            'port': parsed.port or 5432,
            'database': parsed.path[1:] if parsed.path else 'aaces_db',
            'user': parsed.username or 'postgres',
            'password': parsed.password or 'postgres'
        }
    
    return {
        'host': os.getenv('DB_HOST', 'localhost'),
        'port': int(os.getenv('DB_PORT', '5432')),
        'database': os.getenv('DB_NAME', 'aaces_db'),
        'user': os.getenv('DB_USER', 'postgres'),
        'password': os.getenv('DB_PASSWORD', 'postgres')
    }

def test_connection():
    """Prueba la conexión a la base de datos"""
    config = get_database_config()
    
    print("🔄 Probando conexión a PostgreSQL...")
    print(f"📍 Host: {config['host']}:{config['port']}")
    print(f"📍 Database: {config['database']}")
    print(f"📍 User: {config['user']}")
    
    try:
        conn = psycopg2.connect(**config)
        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        version = cursor.fetchone()
        print(f"✅ Conexión exitosa!")
        print(f"📊 PostgreSQL Version: {version[0]}")
        cursor.close()
        conn.close()
        return True
    except Exception as e:
        print(f"❌ Error de conexión: {e}")
        return False

def show_tables():
    """Muestra todas las tablas en la base de datos"""
    config = get_database_config()
    
    try:
        conn = psycopg2.connect(**config)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        """)
        
        tables = cursor.fetchall()
        print(f"\n📋 Tablas encontradas ({len(tables)}):")
        
        for table in tables:
            table_name = table['table_name']
            cursor.execute(f"SELECT COUNT(*) as count FROM {table_name};")
            count = cursor.fetchone()['count']
            print(f"  📊 {table_name}: {count} registros")
        
        cursor.close()
        conn.close()
        return tables
        
    except Exception as e:
        print(f"❌ Error al mostrar tablas: {e}")
        return []

def show_users():
    """Muestra todos los usuarios registrados"""
    config = get_database_config()
    
    try:
        conn = psycopg2.connect(**config)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute("""
            SELECT 
                u.id,
                u.email,
                u.username,
                u.full_name,
                u.role,
                u.is_active,
                u.created_at,
                u.updated_at,
                u.last_login,
                u.failed_login_attempts,
                u.is_locked
            FROM users u
            ORDER BY u.created_at DESC;
        """)
        
        users = cursor.fetchall()
        print(f"\n👥 Usuarios registrados ({len(users)}):")
        
        for user in users:
            status = "✅ Activo" if user['is_active'] else "❌ Inactivo"
            locked = "🔒 Bloqueado" if user['is_locked'] else "🔓 Libre"
            
            print(f"\n  📧 {user['email']}")
            print(f"     👤 Username: {user['username']}")
            print(f"     📝 Nombre: {user['full_name']}")
            print(f"     🎭 Rol: {user['role']}")
            print(f"     📊 Estado: {status}")
            print(f"     🔐 Seguridad: {locked}")
            print(f"     📅 Creado: {user['created_at']}")
            print(f"     🔑 Intentos fallidos: {user['failed_login_attempts']}")
            if user['last_login']:
                print(f"     ⏰ Último acceso: {user['last_login']}")
        
        cursor.close()
        conn.close()
        return users
        
    except Exception as e:
        print(f"❌ Error al mostrar usuarios: {e}")
        return []

def check_specific_users():
    """Verifica usuarios específicos de prueba"""
    config = get_database_config()
    test_emails = ['admin@aaces.com', 'cliente1@example.com']
    
    try:
        conn = psycopg2.connect(**config)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        print(f"\n🔍 Verificando usuarios de prueba:")
        
        for email in test_emails:
            cursor.execute("""
                SELECT 
                    u.id,
                    u.email,
                    u.username,
                    u.full_name,
                    u.role,
                    u.is_active,
                    u.password_hash
                FROM users u
                WHERE u.email = %s;
            """, (email,))
            
            user = cursor.fetchone()
            if user:
                print(f"\n  ✅ Usuario encontrado: {email}")
                print(f"     📝 Username: {user['username']}")
                print(f"     👤 Nombre: {user['full_name']}")
                print(f"     🎭 Rol: {user['role']}")
                print(f"     📊 Activo: {'Sí' if user['is_active'] else 'No'}")
                print(f"     🔐 Hash password: {user['password_hash'][:20]}...")
            else:
                print(f"\n  ❌ Usuario NO encontrado: {email}")
                print(f"     💡 Este usuario será creado automáticamente")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error al verificar usuarios: {e}")

def create_test_users():
    """Crea usuarios de prueba si no existen"""
    config = get_database_config()
    
    try:
        conn = psycopg2.connect(**config)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Verificar si el administrador existe
        cursor.execute("SELECT id FROM users WHERE email = 'admin@aaces.com';")
        admin_exists = cursor.fetchone()
        
        if not admin_exists:
            print("\n🔧 Creando usuario administrador...")
            cursor.execute("""
                INSERT INTO users (email, username, full_name, password_hash, role, is_active, created_at, updated_at)
                VALUES ('admin@aaces.com', 'admin', 'Administrador del Sistema', 
                        '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.PJ/..G', 
                        'admin', true, NOW(), NOW());
            """)
            print("✅ Administrador creado exitosamente!")
        else:
            print("\n✅ El administrador ya existe")
        
        # Verificar si el cliente existe
        cursor.execute("SELECT id FROM users WHERE email = 'cliente1@example.com';")
        client_exists = cursor.fetchone()
        
        if not client_exists:
            print("\n🔧 Creando usuario cliente...")
            cursor.execute("""
                INSERT INTO users (email, username, full_name, password_hash, role, is_active, created_at, updated_at)
                VALUES ('cliente1@example.com', 'cliente1', 'Cliente de Prueba', 
                        '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.PJ/..G', 
                        'client', true, NOW(), NOW());
            """)
            print("✅ Cliente creado exitosamente!")
        else:
            print("\n✅ El cliente ya existe")
        
        conn.commit()
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error al crear usuarios de prueba: {e}")

def show_database_structure():
    """Muestra la estructura completa de la base de datos"""
    config = get_database_config()
    
    try:
        conn = psycopg2.connect(**config)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute("""
            SELECT 
                table_name,
                column_name,
                data_type,
                is_nullable,
                column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
            ORDER BY table_name, ordinal_position;
        """)
        
        columns = cursor.fetchall()
        
        print(f"\n🏗️  Estructura de la base de datos:")
        current_table = ""
        
        for col in columns:
            if col['table_name'] != current_table:
                current_table = col['table_name']
                print(f"\n📋 Tabla: {current_table}")
                print("   Columna                | Tipo          | Nullable | Default")
                print("   " + "-" * 60)
            
            nullable = "Sí" if col['is_nullable'] == 'YES' else "No"
            default = col['column_default'] if col['column_default'] else "-"
            
            print(f"   {col['column_name']:<20} | {col['data_type']:<13} | {nullable:<8} | {default}")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error al mostrar estructura: {e}")

def interactive_mode():
    """Modo interactivo para ejecutar SQL personalizado"""
    config = get_database_config()
    
    print("\n🔧 MODO INTERACTIVO")
    print("Escribe tus consultas SQL (escribe 'exit' para salir):")
    print("Ejemplos:")
    print("  SELECT * FROM users LIMIT 5;")
    print("  SELECT email, role FROM users WHERE is_active = true;")
    print("  UPDATE users SET is_active = true WHERE email = 'admin@aaces.com';")
    print()
    
    try:
        conn = psycopg2.connect(**config)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        while True:
            query = input("SQL> ").strip()
            
            if query.lower() == 'exit':
                break
            
            if not query:
                continue
            
            try:
                cursor.execute(query)
                
                if query.strip().upper().startswith('SELECT'):
                    results = cursor.fetchall()
                    if results:
                        print(f"\n📊 Resultados ({len(results)} filas):")
                        for row in results:
                            print(dict(row))
                    else:
                        print("📊 No se encontraron resultados")
                else:
                    conn.commit()
                    print(f"✅ Consulta ejecutada exitosamente. Filas afectadas: {cursor.rowcount}")
                
            except Exception as e:
                print(f"❌ Error en la consulta: {e}")
                conn.rollback()
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error en modo interactivo: {e}")

def main():
    """Función principal del script"""
    print("🔍 DIAGNÓSTICO COMPLETO DE BASE DE DATOS AACES")
    print("=" * 50)
    
    # Configuración
    config = get_database_config()
    print(f"\n📍 Configuración actual:")
    print(f"   Host: {config['host']}:{config['port']}")
    print(f"   Database: {config['database']}")
    print(f"   User: {config['user']}")
    print(f"   Password: {'*' * len(config['password'])}")
    
    # Menú principal
    while True:
        print("\n" + "=" * 50)
        print("📋 MENÚ DE OPCIONES:")
        print("1. 🔄 Probar conexión a base de datos")
        print("2. 📊 Ver todas las tablas")
        print("3. 👥 Ver todos los usuarios")
        print("4. 🔍 Verificar usuarios específicos (admin@aaces.com, cliente1@example.com)")
        print("5. 🔧 Crear usuarios de prueba si no existen")
        print("6. 🏗️  Ver estructura completa de la base de datos")
        print("7. 💬 Modo interactivo (ejecutar SQL personalizado)")
        print("8. 🚪 Salir")
        
        choice = input("\nSelecciona una opción (1-8): ").strip()
        
        if choice == '1':
            test_connection()
        elif choice == '2':
            show_tables()
        elif choice == '3':
            show_users()
        elif choice == '4':
            check_specific_users()
        elif choice == '5':
            create_test_users()
        elif choice == '6':
            show_database_structure()
        elif choice == '7':
            interactive_mode()
        elif choice == '8':
            print("\n👋 ¡Hasta luego!")
            break
        else:
            print("❌ Opción no válida. Por favor selecciona 1-8.")

if __name__ == "__main__":
    main()