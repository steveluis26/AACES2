#!/usr/bin/env python3
"""
Script para poblar la base de datos AACES con datos de prueba usando psycopg2
"""

import psycopg2
import random
from datetime import datetime, timedelta, date
import sys
import os

# Configuración de la base de datos
DATABASE_CONFIG = {
    "host": "localhost",
    "port": "5432",
    "database": "aaces_db",
    "user": "aaces_user",
    "password": "aaces_password"
}

# Datos de prueba
NOMBRES = [
    "Juan", "María", "Carlos", "Ana", "Luis", "Elena", "Pedro", "Lucía", 
    "Diego", "Sofía", "Miguel", "Valentina", "José", "Camila", "Antonio", "Isabella"
]

APELLIDOS = [
    "Pérez", "González", "Rodríguez", "Fernández", "López", "Martínez", 
    "Sánchez", "Gómez", "Torres", "Díaz", "Vargas", "Ramírez", "Morales", "Jiménez"
]

CIUDADES = ["Quito", "Guayaquil", "Cuenca", "Manta", "Ambato", "Riobamba", "Loja", "Esmeraldas"]

ESPECIALIDADES = [
    "Desarrollo Web", "Seguridad Informática", "Gestión de Proyectos", 
    "Marketing Digital", "Análisis de Datos", "Inteligencia Artificial",
    "Cloud Computing", "DevOps", "Ciberseguridad", "UX/UI Design"
]

CATEGORIAS_CURSOS = [
    "Tecnología", "Negocios", "Salud", "Educación", "Marketing", 
    "Finanzas", "Diseño", "Ingeniería", "Idiomas", "Certificaciones"
]

MODALIDADES = ["presencial", "virtual", "mixta"]

TIPOS_DOCUMENTO = ["DNI", "PASAPORTE", "CEDULA", "OTRO"]

GENEROS = ["M", "F", "Otro"]

CATEGORIAS_CLIENTE = ["basico", "premium", "enterprise"]

ESTADOS_CURSO = ["activo", "finalizado", "en_espera", "cancelado"]

ESTADOS_PAGO = ["pagado", "anticipo", "pendiente", "cancelado"]

METODOS_PAGO = ["efectivo", "transferencia", "tarjeta", "paypal", "otro"]

TIPOS_PAGO = ["participante", "capacitador", "curso_completo"]


def generar_correo(nombre, apellido, empresa="empresa"):
    """Generar un correo electrónico único"""
    return f"{nombre.lower()}.{apellido.lower()}@{empresa.lower()}.com"


def generar_fecha_nacimiento():
    """Generar fecha de nacimiento aleatoria"""
    start_date = date(1980, 1, 1)
    end_date = date(2000, 12, 31)
    
    time_between_dates = end_date - start_date
    days_between_dates = time_between_dates.days
    random_number_of_days = random.randrange(days_between_dates)
    
    return start_date + timedelta(days=random_number_of_days)


def generar_password_hash():
    """Generar un hash de contraseña simple (bcrypt)"""
    # Usar un hash fijo de "password123" para pruebas
    return "$2b$12$KIXxPftJ0xL9iRzQ9Xx8OuX9Xx8OuX9Xx8OuX9Xx8OuX9Xx8OuXi"


def crear_clientes(cursor, cantidad=15):
    """Crear clientes de prueba"""
    print(f"Creando {cantidad} clientes...")
    
    for i in range(cantidad):
        nombre = random.choice(NOMBRES)
        apellido = random.choice(APELLIDOS)
        nombre_completo = f"{nombre} {apellido}"
        correo = generar_correo(nombre, apellido, f"cliente{i+1}")
        ciudad = random.choice(CIUDADES)
        categoria = random.choice(CATEGORIAS_CLIENTE)
        
        cursor.execute("""
            INSERT INTO aaces.clientes (nombre, correo, password_hash, ciudad_base, categoria, estado, fecha_creacion, fecha_actualizacion)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (nombre_completo, correo, generar_password_hash(), ciudad, categoria, "activo", datetime.utcnow(), datetime.utcnow()))
    
    print(f"✓ {cantidad} clientes creados exitosamente")


def crear_capacitadores(cursor, cantidad=10):
    """Crear capacitadores de prueba"""
    print(f"Creando {cantidad} capacitadores...")
    
    for i in range(cantidad):
        nombre = random.choice(NOMBRES)
        apellido = random.choice(APELLIDOS)
        nombre_completo = f"{nombre} {apellido}"
        correo = generar_correo(nombre, apellido, f"capacitador{i+1}")
        telefono = f"09{random.randint(10000000, 99999999)}"
        especialidad = random.choice(ESPECIALIDADES)
        experiencia_anos = random.randint(2, 15)
        
        cursor.execute("""
            INSERT INTO aaces.capacitadores (nombre, correo, telefono, especialidad, experiencia_anos, estado, fecha_creacion, fecha_actualizacion)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (nombre_completo, correo, telefono, especialidad, experiencia_anos, "activo", datetime.utcnow(), datetime.utcnow()))
    
    print(f"✓ {cantidad} capacitadores creados exitosamente")


def crear_cursos(cursor, cantidad=40):
    """Crear cursos de prueba"""
    print(f"Creando {cantidad} cursos...")
    
    # Obtener capacitadores existentes
    cursor.execute("SELECT id FROM aaces.capacitadores")
    capacitadores = cursor.fetchall()
    
    if not capacitadores:
        print("⚠️ No hay capacitadores, creando cursos sin capacitador")
        capacitadores = [(None,)]
    
    fecha_base = datetime.utcnow()
    
    for i in range(cantidad):
        duracion = random.randint(8, 40)  # 8 a 40 horas
        costo = random.randint(50, 500)  # $50 a $500
        
        # Fechas del curso
        fecha_inicio = fecha_base + timedelta(days=random.randint(-30, 90))
        fecha_fin = fecha_inicio + timedelta(days=random.randint(1, 7))
        
        titulo = f"Curso de {random.choice(ESPECIALIDADES)} {i+1}"
        descripcion = f"Descripción detallada del curso {i+1}. Aprenda las mejores prácticas y técnicas avanzadas."
        categoria = random.choice(CATEGORIAS_CURSOS)
        ciudad = random.choice(CIUDADES)
        modalidad = random.choice(MODALIDADES)
        estado = random.choice(ESTADOS_CURSO)
        capacitador_id = random.choice(capacitadores)[0]
        
        codigo_curso = f"CURSO-{i+1:03d}"
        
        cursor.execute("""
            INSERT INTO aaces.cursos (titulo, descripcion, categoria, duracion_horas, costo, fecha_inicio, fecha_fin, ciudad, modalidad, capacitador_id, estado, codigo_curso, fecha_creacion, fecha_actualizacion)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (titulo, descripcion, categoria, duracion, costo, fecha_inicio.date(), fecha_fin.date(), ciudad, modalidad, capacitador_id, estado, codigo_curso, datetime.utcnow(), datetime.utcnow()))
    
    print(f"✓ {cantidad} cursos creados exitosamente")


def crear_participantes(cursor, cantidad=150):
    """Crear participantes de prueba"""
    print(f"Creando {cantidad} participantes...")
    
    # Obtener clientes existentes
    cursor.execute("SELECT id FROM aaces.clientes")
    clientes = cursor.fetchall()
    
    if not clientes:
        print("⚠️ No hay clientes, creando participantes sin cliente")
        clientes = [(None,)]
    
    for i in range(cantidad):
        nombre = random.choice(NOMBRES)
        apellido = random.choice(APELLIDOS)
        nombre_completo = f"{nombre} {apellido}"
        correo = generar_correo(nombre, apellido, f"participante{i+1}")
        telefono = f"09{random.randint(10000000, 99999999)}"
        tipo_documento = random.choice(TIPOS_DOCUMENTO)
        numero_documento = f"{random.randint(1000000000, 9999999999)}"
        fecha_nacimiento = generar_fecha_nacimiento()
        genero = random.choice(GENEROS)
        ciudad = random.choice(CIUDADES)
        cliente_id = random.choice(clientes)[0]
        
        cursor.execute("""
            INSERT INTO aaces.participantes (nombre, apellido, correo, telefono, tipo_documento, numero_documento, fecha_nacimiento, genero, ciudad, cliente_id, fecha_creacion, fecha_actualizacion)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (nombre, apellido, correo, telefono, tipo_documento, numero_documento, fecha_nacimiento, genero, ciudad, cliente_id, datetime.utcnow(), datetime.utcnow()))
    
    print(f"✓ {cantidad} participantes creados exitosamente")


def crear_inscripciones_cursos(cursor):
    """Crear inscripciones de participantes a cursos"""
    print("Creando inscripciones a cursos...")
    
    # Obtener cursos activos y participantes
    cursor.execute("SELECT id, costo FROM aaces.cursos WHERE estado = 'activo'")
    cursos = cursor.fetchall()
    
    cursor.execute("SELECT id, cliente_id FROM aaces.participantes")
    participantes = cursor.fetchall()
    
    if not cursos or not participantes:
        print("⚠️ No hay suficientes cursos o participantes")
        return
    
    inscripciones_creadas = 0
    
    for curso in cursos:
        # Inscribir entre 3 y 15 participantes por curso activo
        num_participantes = random.randint(3, min(15, len(participantes)))
        participantes_seleccionados = random.sample(participantes, num_participantes)
        
        for participante in participantes_seleccionados:
            # Verificar que el participante no esté ya inscrito en este curso
            cursor.execute("""
                SELECT id FROM aaces.curso_participante 
                WHERE curso_id = %s AND participante_id = %s
            """, (curso[0], participante[0]))
            
            existing = cursor.fetchone()
            
            if not existing:
                nota_final = random.uniform(0, 10) if random.random() > 0.1 else None  # 90% tienen nota
                acreditado = nota_final is not None and nota_final >= 7.0
                
                fecha_emision = datetime.utcnow() if acreditado else None
                fecha_expiracion = (datetime.utcnow() + timedelta(days=1095)).date() if acreditado else None
                
                # Generar código de validación único
                codigo_validacion = f"VAL-{random.randint(100000, 999999)}"
                
                cursor.execute("""
                    INSERT INTO aaces.curso_participante (curso_id, participante_id, fecha_inscripcion, estado_pago, monto_pagado, nota_final, porcentaje_asistencia, acreditado, fecha_emision_certificado, fecha_expiracion_certificado, codigo_validacion, fecha_creacion, fecha_actualizacion)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, 
                (curso[0], participante[0], datetime.utcnow() - timedelta(days=random.randint(1, 30)), 
                random.choice(ESTADOS_PAGO), curso[1] if random.random() > 0.2 else curso[1] * 0.5, 
                nota_final, random.uniform(60, 100) if nota_final else None, acreditado, 
                fecha_emision, fecha_expiracion, codigo_validacion, datetime.utcnow(), datetime.utcnow()))
                
                inscripciones_creadas += 1
    
    print(f"✓ {inscripciones_creadas} inscripciones creadas exitosamente")


def crear_pagos(cursor):
    """Crear pagos para las inscripciones"""
    print("Creando pagos...")
    
    # Obtener inscripciones pagadas
    cursor.execute("""
        SELECT cp.id, cp.participante_id, cp.monto_pagado, p.cliente_id 
        FROM aaces.curso_participante cp
        JOIN aaces.participantes p ON cp.participante_id = p.id
        WHERE cp.estado_pago = 'pagado'
    """)
    
    inscripciones = cursor.fetchall()
    
    if not inscripciones:
        print("⚠️ No hay inscripciones pagadas")
        return
    
    pagos_creados = 0
    
    for inscripcion in inscripciones:
        # Crear entre 1 y 3 pagos por inscripción pagada
        num_pagos = random.randint(1, 3)
        monto_total = float(inscripcion[2])
        monto_por_pago = monto_total / num_pagos
        
        for i in range(num_pagos):
            cursor.execute("""
                INSERT INTO aaces.pagos (curso_participante_id, cliente_id, monto, tipo_pago, metodo_pago, fecha_pago, estado_pago, referencia_pago, notas, fecha_creacion, fecha_actualizacion)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, 
            (inscripcion[0], inscripcion[3], monto_por_pago, 
            random.choice(TIPOS_PAGO), random.choice(METODOS_PAGO), 
            datetime.utcnow() - timedelta(days=random.randint(1, 60)), 
            "completado", f"REF-{random.randint(10000, 99999)}", 
            f"Pago {i+1} de {num_pagos}", datetime.utcnow(), datetime.utcnow()))
            
            pagos_creados += 1
    
    print(f"✓ {pagos_creados} pagos creados exitosamente")


def main():
    """Función principal para poblar la base de datos"""
    print("🚀 Iniciando poblamiento de base de datos AACES...")
    print("=" * 50)
    
    conn = None
    try:
        # Conectar a la base de datos
        conn = psycopg2.connect(**DATABASE_CONFIG)
        conn.autocommit = True
        cursor = conn.cursor()
        print("✓ Conexión a base de datos establecida")
        
        # Crear clientes
        crear_clientes(cursor, 15)
        
        # Crear capacitadores
        crear_capacitadores(cursor, 10)
        
        # Crear cursos
        crear_cursos(cursor, 40)
        
        # Crear participantes
        crear_participantes(cursor, 150)
        
        # Crear inscripciones
        crear_inscripciones_cursos(cursor)
        
        # Crear pagos
        crear_pagos(cursor)
        
        # Obtener estadísticas finales
        cursor.execute("SELECT COUNT(*) FROM aaces.clientes")
        clientes_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM aaces.capacitadores")
        capacitadores_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM aaces.cursos")
        cursos_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM aaces.participantes")
        participantes_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM aaces.curso_participante")
        inscripciones_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM aaces.pagos")
        pagos_count = cursor.fetchone()[0]
        
        print("\n" + "=" * 50)
        print("✅ Poblamiento completado exitosamente!")
        print(f"📊 Resumen final:")
        print(f"   • Clientes: {clientes_count}")
        print(f"   • Capacitadores: {capacitadores_count}")
        print(f"   • Cursos: {cursos_count}")
        print(f"   • Participantes: {participantes_count}")
        print(f"   • Inscripciones: {inscripciones_count}")
        print(f"   • Pagos: {pagos_count}")
        
    except Exception as e:
        print(f"❌ Error durante el poblamiento: {str(e)}")
        if conn:
            conn.rollback()
        raise
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


if __name__ == "__main__":
    main()