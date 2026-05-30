#!/usr/bin/env python3
"""
Script de acceso directo a la base de datos PostgreSQL para AACES
Este script permite explorar la base de datos y verificar usuarios
"""

import psycopg2
import psycopg2.extras
from datetime import datetime
import json
import os
from typing import List, Dict, Any

# Configuración de conexión desde docker-compose.yml
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'aaces_db',
    'user': 'aaces_user',
    'password': 'aaces_password'
}

class DatabaseExplorer:
    def __init__(self):
        self.connection = None
        
    def connect(self) -> bool:
        """Conectar a la base de datos PostgreSQL"""
        try:
            self.connection = psycopg2.connect(**DB_CONFIG)
            print("✅ Conexión exitosa a PostgreSQL")
            print(f"📊 Base de datos: {DB_CONFIG['database']}")
            print(f"👤 Usuario: {DB_CONFIG['user']}")
            return True
        except Exception as e:
            print(f"❌ Error de conexión: {e}")
            return False
    
    def execute_query(self, query: str, params: tuple = None) -> List[Dict[str, Any]]:
        """Ejecutar consulta y retornar resultados como diccionarios"""
        try:
            with self.connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                cursor.execute(query, params)
                return cursor.fetchall()
        except Exception as e:
            print(f"❌ Error ejecutando consulta: {e}")
            return []
    
    def execute_command(self, command: str, params: tuple = None) -> bool:
        """Ejecutar comando (INSERT, UPDATE, DELETE)"""
        try:
            with self.connection.cursor() as cursor:
                cursor.execute(command, params)
                self.connection.commit()
                return True
        except Exception as e:
            print(f"❌ Error ejecutando comando: {e}")
            self.connection.rollback()
            return False
    
    def list_tables(self):
        """Listar todas las tablas en la base de datos"""
        query = """
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
        """
        tables = self.execute_query(query)
        print("\n📋 Tablas en la base de datos:")
        for table in tables:
            print(f"  - {table['table_name']}")
        return tables
    
    def describe_table(self, table_name: str):
        """Describir estructura de una tabla"""
        query = """
        SELECT 
            column_name,
            data_type,
            is_nullable,
            column_default,
            character_maximum_length
        FROM information_schema.columns
        WHERE table_name = %s
        ORDER BY ordinal_position;
        """
        columns = self.execute_query(query, (table_name,))
        print(f"\n🔍 Estructura de la tabla '{table_name}':")
        for col in columns:
            nullable = "NULL" if col['is_nullable'] == 'YES' else "NOT NULL"
            default = f" DEFAULT {col['column_default']}" if col['column_default'] else ""
            print(f"  - {col['column_name']}: {col['data_type']}{nullable}{default}")
        return columns
    
    def list_users(self):
        """Listar todos los usuarios con sus roles"""
        query = """
        SELECT 
            u.id,
            u.email,
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
        """
        users = self.execute_query(query)
        print(f"\n👥 Usuarios registrados ({len(users)} encontrados):")
        for user in users:
            status = "✅ Activo" if user['is_active'] else "❌ Inactivo"
            locked = "🔒 Bloqueado" if user['is_locked'] else "🔓 Desbloqueado"
            print(f"  - {user['email']} ({user['role']})")
            print(f"    Nombre: {user['full_name']}")
            print(f"    Estado: {status} | {locked}")
            print(f"    Creado: {user['created_at']}")
            print(f"    Último login: {user['last_login']}")
            print(f"    Intentos fallidos: {user['failed_login_attempts']}")
            print()
        return users
    
    def find_user_by_email(self, email: str):
        """Buscar usuario por email"""
        query = """
        SELECT 
            u.id,
            u.email,
            u.full_name,
            u.role,
            u.is_active,
            u.created_at,
            u.updated_at,
            u.last_login,
            u.failed_login_attempts,
            u.is_locked,
            u.password_hash
        FROM users u
        WHERE u.email = %s;
        """
        users = self.execute_query(query, (email,))
        if users:
            user = users[0]
            print(f"\n🔍 Usuario encontrado: {email}")
            print(f"  ID: {user['id']}")
            print(f"  Nombre: {user['full_name']}")
            print(f"  Rol: {user['role']}")
            print(f"  Activo: {'Sí' if user['is_active'] else 'No'}")
            print(f"  Bloqueado: {'Sí' if user['is_locked'] else 'No'}")
            print(f"  Hash contraseña: {user['password_hash'][:50]}...")
            print(f"  Creado: {user['created_at']}")
            print(f"  Último login: {user['last_login']}")
        else:
            print(f"❌ Usuario no encontrado: {email}")
        return users
    
    def create_test_users(self):
        """Crear usuarios de prueba si no existen"""
        from datetime import datetime
        import bcrypt
        
        # Verificar si el usuario admin existe
        admin_exists = len(self.find_user_by_email('admin@aaces.com')) > 0
        
        if not admin_exists:
            print("\n🔧 Creando usuario admin@aaces.com...")
            # Hash de contraseña 'admin123' (puedes cambiarla)
            password_hash = bcrypt.hashpw('admin123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            query = """
            INSERT INTO users (email, full_name, password_hash, role, is_active, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s);
            """
            success = self.execute_command(query, (
                'admin@aaces.com',
                'Administrador AACES',
                password_hash,
                'admin',
                True,
                datetime.now(),
                datetime.now()
            ))
            if success:
                print("✅ Usuario admin creado exitosamente")
                print("   Email: admin@aaces.com")
                print("   Contraseña: admin123")
                print("   Rol: admin")
        
        # Verificar si el usuario cliente existe
        cliente_exists = len(self.find_user_by_email('cliente1@example.com')) > 0
        
        if not cliente_exists:
            print("\n🔧 Creando usuario cliente1@example.com...")
            # Hash de contraseña 'cliente123'
            password_hash = bcrypt.hashpw('cliente123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            query = """
            INSERT INTO users (email, full_name, password_hash, role, is_active, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s);
            """
            success = self.execute_command(query, (
                'cliente1@example.com',
                'Cliente de Prueba',
                password_hash,
                'cliente',
                True,
                datetime.now(),
                datetime.now()
            ))
            if success:
                print("✅ Usuario cliente creado exitosamente")
                print("   Email: cliente1@example.com")
                print("   Contraseña: cliente123")
                print("   Rol: cliente")
    
    def check_connection_health(self):
        """Verificar salud de la conexión"""
        try:
            # Verificar si podemos hacer una consulta simple
            result = self.execute_query("SELECT version();")
            if result:
                print(f"\n✅ PostgreSQL está funcionando: {result[0]['version']}")
            
            # Verificar número de conexiones activas
            connections = self.execute_query("SELECT count(*) as active_connections FROM pg_stat_activity;")
            if connections:
                print(f"📊 Conexiones activas: {connections[0]['active_connections']}")
            
            return True
        except Exception as e:
            print(f"❌ Error verificando salud: {e}")
            return False
    
    def close(self):
        """Cerrar conexión a la base de datos"""
        if self.connection:
            self.connection.close()
            print("\n🔒 Conexión cerrada")

def main():
    """Función principal interactiva"""
    explorer = DatabaseExplorer()
    
    print("🚀 Explorador de Base de Datos AACES")
    print("=" * 40)
    
    # Conectar a la base de datos
    if not explorer.connect():
        print("❌ No se pudo conectar a la base de datos")
        return
    
    # Verificar salud de conexión
    explorer.check_connection_health()
    
    # Mostrar tablas
    tables = explorer.list_tables()
    
    if not tables:
        print("⚠️  No se encontraron tablas. La base de datos parece estar vacía.")
        print("   ¿Ejecutaste las migraciones?")
    else:
        # Mostrar estructura de tabla users
        if any(table['table_name'] == 'users' for table in tables):
            explorer.describe_table('users')
            
            # Listar usuarios
            explorer.list_users()
            
            # Buscar usuarios específicos
            print("\n🔍 Buscando usuarios de prueba...")
            explorer.find_user_by_email('admin@aaces.com')
            explorer.find_user_by_email('cliente1@example.com')
            
            # Preguntar si crear usuarios de prueba
            response = input("\n¿Deseas crear usuarios de prueba si no existen? (s/n): ").lower()
            if response == 's':
                explorer.create_test_users()
                # Volver a listar usuarios
                explorer.list_users()
        else:
            print("⚠️  No se encontró la tabla 'users'. ¿Ejecutaste las migraciones?")
    
    # Menú interactivo
    while True:
        print("\n" + "="*50)
        print("🎯 Menú de Exploración")
        print("1. Listar todas las tablas")
        print("2. Describir una tabla")
        print("3. Listar usuarios")
        print("4. Buscar usuario por email")
        print("5. Crear usuarios de prueba")
        print("6. Ejecutar consulta SQL personalizada")
        print("7. Verificar conexión")
        print("8. Salir")
        
        choice = input("\nSelecciona una opción (1-8): ").strip()
        
        if choice == '1':
            explorer.list_tables()
        elif choice == '2':
            table_name = input("Nombre de la tabla: ").strip()
            explorer.describe_table(table_name)
        elif choice == '3':
            explorer.list_users()
        elif choice == '4':
            email = input("Email del usuario: ").strip()
            explorer.find_user_by_email(email)
        elif choice == '5':
            explorer.create_test_users()
        elif choice == '6':
            query = input("Consulta SQL (SELECT * FROM users WHERE...): ").strip()
            if query.upper().startswith('SELECT'):
                results = explorer.execute_query(query)
                if results:
                    print(f"\n📊 Resultados ({len(results)}):")
                    for i, row in enumerate(results[:10]):  # Mostrar máximo 10 filas
                        print(f"  {i+1}. {dict(row)}")
                    if len(results) > 10:
                        print(f"  ... y {len(results) - 10} más")
                else:
                    print("❌ Sin resultados o error en la consulta")
            else:
                print("⚠️  Solo se permiten consultas SELECT")
        elif choice == '7':
            explorer.check_connection_health()
        elif choice == '8':
            break
        else:
            print("❌ Opción no válida")
    
    explorer.close()
    print("\n👋 ¡Hasta luego!")

if __name__ == "__main__":
    main()