#!/usr/bin/env python3
"""
Script interactivo para explorar la base de datos AACES
Proporciona acceso completo para verificar usuarios, conexión y estructura
"""

import psycopg2
import psycopg2.extras
import os
import sys
from datetime import datetime
import json
from typing import Dict, List, Any, Optional

class DatabaseExplorer:
    def __init__(self):
        # Configuración de conexión desde variables de entorno o valores por defecto
        self.db_config = {
            'host': os.getenv('DB_HOST', 'localhost'),
            'port': os.getenv('DB_PORT', '5432'),
            'database': os.getenv('DB_NAME', 'aaces_db'),
            'user': os.getenv('DB_USER', 'aaces_user'),
            'password': os.getenv('DB_PASSWORD', 'aaces_password')
        }
        self.conn = None
        self.cursor = None
        
    def connect(self) -> bool:
        """Conectar a la base de datos"""
        try:
            print(f"🔄 Conectando a PostgreSQL...")
            print(f"📍 Host: {self.db_config['host']}:{self.db_config['port']}")
            print(f"📊 Base de datos: {self.db_config['database']}")
            print(f"👤 Usuario: {self.db_config['user']}")
            
            self.conn = psycopg2.connect(**self.db_config)
            self.cursor = self.conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            
            # Verificar conexión
            self.cursor.execute("SELECT version();")
            version = self.cursor.fetchone()
            print(f"✅ Conexión exitosa!")
            print(f"📋 PostgreSQL: {version['version']}")
            return True
            
        except Exception as e:
            print(f"❌ Error de conexión: {e}")
            return False
    
    def check_connection_status(self) -> Dict[str, Any]:
        """Verificar estado completo de la conexión"""
        try:
            # Información básica
            self.cursor.execute("""
                SELECT 
                    current_database() as database,
                    current_user as user,
                    inet_server_addr() as server_ip,
                    inet_server_port() as server_port,
                    pg_backend_pid() as connection_pid,
                    current_timestamp as server_time
            """)
            basic_info = self.cursor.fetchone()
            
            # Verificar extensiones
            self.cursor.execute("""
                SELECT name, default_version, installed_version 
                FROM pg_available_extensions 
                WHERE installed_version IS NOT NULL
                ORDER BY name
            """)
            extensions = self.cursor.fetchall()
            
            # Verificar esquemas
            self.cursor.execute("""
                SELECT schema_name, owner 
                FROM information_schema.schemata 
                ORDER BY schema_name
            """)
            schemas = self.cursor.fetchall()
            
            return {
                'connection_info': dict(basic_info) if basic_info else {},
                'extensions': [dict(ext) for ext in extensions],
                'schemas': [dict(sch) for sch in schemas]
            }
            
        except Exception as e:
            return {'error': str(e)}
    
    def list_all_tables(self) -> List[Dict[str, Any]]:
        """Listar todas las tablas del esquema aaces"""
        try:
            self.cursor.execute("""
                SELECT 
                    table_name,
                    table_type,
                    table_schema,
                    pg_size_pretty(pg_total_relation_size(table_schema||'.'||table_name)) as size
                FROM information_schema.tables 
                WHERE table_schema = 'aaces'
                ORDER BY table_name
            """)
            return [dict(row) for row in self.cursor.fetchall()]
        except Exception as e:
            print(f"Error al listar tablas: {e}")
            return []
    
    def show_table_structure(self, table_name: str) -> Dict[str, Any]:
        """Mostrar estructura completa de una tabla"""
        try:
            # Columnas
            self.cursor.execute("""
                SELECT 
                    column_name,
                    data_type,
                    character_maximum_length,
                    is_nullable,
                    column_default,
                    udt_name
                FROM information_schema.columns
                WHERE table_schema = 'aaces' AND table_name = %s
                ORDER BY ordinal_position
            """, (table_name,))
            columns = [dict(row) for row in self.cursor.fetchall()]
            
            # Índices
            self.cursor.execute("""
                SELECT indexname, indexdef
                FROM pg_indexes
                WHERE schemaname = 'aaces' AND tablename = %s
                ORDER BY indexname
            """, (table_name,))
            indexes = [dict(row) for row in self.cursor.fetchall()]
            
            # Restricciones
            self.cursor.execute("""
                SELECT 
                    constraint_name,
                    constraint_type
                FROM information_schema.table_constraints
                WHERE table_schema = 'aaces' AND table_name = %s
                ORDER BY constraint_name
            """, (table_name,))
            constraints = [dict(row) for row in self.cursor.fetchall()]
            
            # Conteo de registros
            self.cursor.execute(f"SELECT COUNT(*) as count FROM aaces.{table_name}")
            count = self.cursor.fetchone()
            
            return {
                'table_name': table_name,
                'row_count': count['count'] if count else 0,
                'columns': columns,
                'indexes': indexes,
                'constraints': constraints
            }
            
        except Exception as e:
            return {'error': str(e), 'table_name': table_name}
    
    def get_all_users(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Obtener todos los usuarios con información completa"""
        try:
            self.cursor.execute("""
                SELECT 
                    c.id,
                    c.nombre,
                    c.correo,
                    c.categoria,
                    c.estado,
                    c.ciudad_base,
                    c.fecha_creacion,
                    c.fecha_actualizacion,
                    c.ultimo_acceso,
                    c.intentos_fallidos,
                    c.fecha_bloqueo,
                    COUNT(p.id) as total_participantes,
                    COUNT(CASE WHEN p.estado = 'activo' THEN 1 END) as participantes_activos
                FROM aaces.clientes c
                LEFT JOIN aaces.participantes p ON c.id = p.cliente_id
                GROUP BY c.id, c.nombre, c.correo, c.categoria, c.estado, 
                         c.ciudad_base, c.fecha_creacion, c.fecha_actualizacion,
                         c.ultimo_acceso, c.intentos_fallidos, c.fecha_bloqueo
                ORDER BY c.fecha_creacion DESC
                LIMIT %s
            """, (limit,))
            
            users = []
            for row in self.cursor.fetchall():
                user = dict(row)
                # Convertir datetime a string para JSON
                for key, value in user.items():
                    if isinstance(value, datetime):
                        user[key] = value.isoformat()
                users.append(user)
            
            return users
            
        except Exception as e:
            print(f"Error al obtener usuarios: {e}")
            return []
    
    def check_specific_users(self) -> Dict[str, Any]:
        """Verificar usuarios específicos de prueba"""
        try:
            # Buscar usuarios específicos
            test_emails = ['admin@aaces.com', 'cliente1@example.com']
            results = {}
            
            for email in test_emails:
                self.cursor.execute("""
                    SELECT id, nombre, correo, categoria, estado, fecha_creacion
                    FROM aaces.clientes 
                    WHERE correo = %s
                """, (email,))
                
                user = self.cursor.fetchone()
                if user:
                    results[email] = {
                        'exists': True,
                        'data': dict(user),
                        'status': '✅ ENCONTRADO'
                    }
                else:
                    results[email] = {
                        'exists': False,
                        'status': '❌ NO ENCONTRADO'
                    }
            
            return results
            
        except Exception as e:
            return {'error': str(e)}
    
    def create_test_users(self) -> Dict[str, Any]:
        """Crear usuarios de prueba si no existen"""
        try:
            from passlib.context import CryptContext
            pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
            
            test_users = [
                {
                    'nombre': 'Administrador AACES',
                    'correo': 'admin@aaces.com',
                    'password': 'Admin123!',
                    'categoria': 'premium',
                    'ciudad_base': 'Bogotá'
                },
                {
                    'nombre': 'Cliente de Prueba',
                    'correo': 'cliente1@example.com',
                    'password': 'Cliente123!',
                    'categoria': 'basico',
                    'ciudad_base': 'Medellín'
                }
            ]
            
            created_users = []
            
            for user_data in test_users:
                # Verificar si ya existe
                self.cursor.execute("""
                    SELECT id FROM aaces.clientes WHERE correo = %s
                """, (user_data['correo'],))
                
                if self.cursor.fetchone():
                    created_users.append({
                        'email': user_data['correo'],
                        'status': 'existed',
                        'message': 'Usuario ya existente'
                    })
                    continue
                
                # Crear usuario
                password_hash = pwd_context.hash(user_data['password'])
                
                self.cursor.execute("""
                    INSERT INTO aaces.clientes (nombre, correo, password_hash, categoria, ciudad_base)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id, nombre, correo, categoria, fecha_creacion
                """, (
                    user_data['nombre'],
                    user_data['correo'],
                    password_hash,
                    user_data['categoria'],
                    user_data['ciudad_base']
                ))
                
                new_user = self.cursor.fetchone()
                self.conn.commit()
                
                created_users.append({
                    'email': user_data['correo'],
                    'status': 'created',
                    'data': dict(new_user),
                    'credentials': {
                        'email': user_data['correo'],
                        'password': user_data['password']
                    }
                })
            
            return {
                'created_count': len([u for u in created_users if u['status'] == 'created']),
                'users': created_users
            }
            
        except Exception as e:
            return {'error': str(e)}
    
    def get_database_stats(self) -> Dict[str, Any]:
        """Obtener estadísticas generales de la base de datos"""
        try:
            stats = {}
            
            # Total de registros por tabla principal
            tables = ['clientes', 'capacitadores', 'cursos', 'participantes', 'pagos']
            
            for table in tables:
                try:
                    self.cursor.execute(f"SELECT COUNT(*) as count FROM aaces.{table}")
                    result = self.cursor.fetchone()
                    stats[table] = result['count'] if result else 0
                except:
                    stats[table] = 0
            
            # Usuarios por categoría
            self.cursor.execute("""
                SELECT categoria, COUNT(*) as total
                FROM aaces.clientes
                GROUP BY categoria
                ORDER BY total DESC
            """)
            users_by_category = [dict(row) for row in self.cursor.fetchall()]
            
            # Usuarios por estado
            self.cursor.execute("""
                SELECT estado, COUNT(*) as total
                FROM aaces.clientes
                GROUP BY estado
                ORDER BY total DESC
            """)
            users_by_status = [dict(row) for row in self.cursor.fetchall()]
            
            return {
                'table_counts': stats,
                'users_by_category': users_by_category,
                'users_by_status': users_by_status
            }
            
        except Exception as e:
            return {'error': str(e)}
    
    def close(self):
        """Cerrar conexión"""
        if self.cursor:
            self.cursor.close()
        if self.conn:
            self.conn.close()
            print("🔌 Conexión cerrada")

def main():
    """Función principal interactiva"""
    explorer = DatabaseExplorer()
    
    print("🚀 EXPLORADOR DE BASE DE DATOS AACES")
    print("=" * 50)
    
    # Conectar a la base de datos
    if not explorer.connect():
        print("❌ No se pudo conectar a la base de datos")
        return
    
    print("\n" + "=" * 50)
    
    try:
        while True:
            print("\n📋 MENÚ DE OPCIONES:")
            print("1. Ver estado de conexión")
            print("2. Listar todas las tablas")
            print("3. Ver estructura de tabla específica")
            print("4. Ver todos los usuarios")
            print("5. Verificar usuarios de prueba específicos")
            print("6. Crear usuarios de prueba")
            print("7. Ver estadísticas de la base de datos")
            print("8. Ejecutar consulta SQL personalizada")
            print("0. Salir")
            
            choice = input("\n👉 Seleccione una opción: ").strip()
            
            if choice == '0':
                break
                
            elif choice == '1':
                print("\n🔍 ESTADO DE CONEXIÓN:")
                status = explorer.check_connection_status()
                if 'error' in status:
                    print(f"❌ Error: {status['error']}")
                else:
                    print(f"📍 Conexión: {status['connection_info']}")
                    print(f"🔌 Extensiones instaladas: {len(status['extensions'])}")
                    print(f"🏗️ Esquemas: {len(status['schemas'])}")
            
            elif choice == '2':
                print("\n📊 TABLAS EN EL ESQUEMA AACES:")
                tables = explorer.list_all_tables()
                for table in tables:
                    print(f"  📋 {table['table_name']} ({table['size']})")
            
            elif choice == '3':
                table_name = input("👉 Nombre de la tabla: ").strip()
                print(f"\n🔍 ESTRUCTURA DE '{table_name}':")
                structure = explorer.show_table_structure(table_name)
                if 'error' in structure:
                    print(f"❌ Error: {structure['error']}")
                else:
                    print(f"📊 Total de registros: {structure['row_count']}")
                    print(f"📋 Columnas: {len(structure['columns'])}")
                    print(f"🔑 Índices: {len(structure['indexes'])}")
                    print(f"⚡ Restricciones: {len(structure['constraints'])}")
            
            elif choice == '4':
                limit = input("👉 Límite de usuarios (default 50): ").strip()
                limit = int(limit) if limit.isdigit() else 50
                print(f"\n👥 USUARIOS REGISTRADOS (últimos {limit}):")
                users = explorer.get_all_users(limit)
                for user in users:
                    print(f"  📧 {user['correo']} - {user['categoria']} - {user['estado']}")
                    print(f"     Creado: {user['fecha_creacion']}")
                    print(f"     Participantes: {user['total_participantes']} activos")
            
            elif choice == '5':
                print("\n🔍 VERIFICANDO USUARIOS DE PRUEBA:")
                results = explorer.check_specific_users()
                for email, info in results.items():
                    print(f"  {email}: {info['status']}")
                    if info.get('data'):
                        print(f"     ID: {info['data']['id']}")
                        print(f"     Nombre: {info['data']['nombre']}")
                        print(f"     Categoría: {info['data']['categoria']}")
            
            elif choice == '6':
                print("\n➕ CREANDO USUARIOS DE PRUEBA:")
                results = explorer.create_test_users()
                if 'error' in results:
                    print(f"❌ Error: {results['error']}")
                else:
                    print(f"✅ Usuarios creados: {results['created_count']}")
                    for user in results['users']:
                        print(f"  📧 {user['email']}: {user['status']}")
                        if user.get('credentials'):
                            print(f"     Credenciales: {user['credentials']['email']} / {user['credentials']['password']}")
            
            elif choice == '7':
                print("\n📈 ESTADÍSTICAS DE LA BASE DE DATOS:")
                stats = explorer.get_database_stats()
                if 'error' in stats:
                    print(f"❌ Error: {stats['error']}")
                else:
                    print("📊 Total de registros:")
                    for table, count in stats['table_counts'].items():
                        print(f"  {table}: {count}")
                    
                    print("\n👥 Usuarios por categoría:")
                    for cat in stats['users_by_category']:
                        print(f"  {cat['categoria']}: {cat['total']}")
                    
                    print("\n📊 Usuarios por estado:")
                    for status in stats['users_by_status']:
                        print(f"  {status['estado']}: {status['total']}")
            
            elif choice == '8':
                print("\n📝 CONSULTA SQL PERSONALIZADA:")
                query = input("👉 Ingrese su consulta SQL: ").strip()
                if query:
                    try:
                        explorer.cursor.execute(query)
                        if query.strip().upper().startswith('SELECT'):
                            results = explorer.cursor.fetchall()
                            print(f"✅ Resultados ({len(results)}):")
                            for row in results:
                                print(dict(row))
                        else:
                            explorer.conn.commit()
                            print("✅ Consulta ejecutada exitosamente")
                    except Exception as e:
                        print(f"❌ Error en consulta: {e}")
                        explorer.conn.rollback()
            
            else:
                print("❌ Opción no válida")
    
    except KeyboardInterrupt:
        print("\n\n👋 Saliendo...")
    
    finally:
        explorer.close()
        print("✅ Explorador cerrado")

if __name__ == "__main__":
    main()