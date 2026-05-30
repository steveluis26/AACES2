#!/usr/bin/env python3
"""
Script simplificado para poblar la base de datos AACES con datos de prueba
"""

import asyncio
import random
from datetime import datetime, timedelta, date
import asyncpg
import sys
import os

# Configuración de la base de datos
DATABASE_URL = "postgresql://aaces_user:aaces_password@172.20.0.3:5432/aaces_db"

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


async def crear_clientes(conn, cantidad: int = 15):
    """Crear clientes de prueba"""
    print(f"Creando {cantidad} clientes...")
    
    for i in range(cantidad):
        nombre = random.choice(NOMBRES)
        apellido = random.choice(APELLIDOS)
        nombre_completo = f"{nombre} {apellido}"
        correo = generar_correo(nombre, apellido, f"cliente{i+1}")
        ciudad = random.choice(CIUDADES)
        categoria = random.choice(CATEGORIAS_CLIENTE)
        
        await conn.execute("""
            INSERT INTO aaces.clientes (nombre, correo, password_hash, ciudad_base, categoria, estado, fecha_creacion, fecha_actualizacion)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        """, nombre_completo, correo, "$2b$12$KIXxPftJ0xL9iRzQ9Xx8OuX9Xx8OuX9Xx8OuX9Xx8OuX9Xx8OuXi", ciudad, categoria, "activo", datetime.utcnow(), datetime.utcnow())
    
    print(f"✓ {cantidad} clientes creados exitosamente")


async def crear_capacitadores(conn, cantidad: int = 10):
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
        
        await conn.execute("""
            INSERT INTO aaces.capacitadores (nombre, correo, telefono, especialidad, experiencia_anos, estado, fecha_creacion, fecha_actualizacion)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        """, nombre_completo, correo, telefono, especialidad, experiencia_anos, "activo", datetime.utcnow(), datetime.utcnow())
    
    print(f"✓ {cantidad} capacitadores creados exitosamente")


async def crear_cursos(conn, cantidad: int = 40):
    """Crear cursos de prueba"""
    print(f"Creando {cantidad} cursos...")
    
    # Obtener capacitadores existentes
    capacitadores = await conn.fetch("SELECT id FROM aaces.capacitadores")
    
    if not capacitadores:
        print("⚠️ No hay capacitadores, creando cursos sin capacitador")
        capacitadores = [{"id": None}]
    
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
        capacitador_id = random.choice(capacitadores)["id"] if capacitadores[0]["id"] else None
        
        codigo_curso = f"CURSO-{i+1:03d}"
        
        await conn.execute("""
            INSERT INTO aaces.cursos (titulo, descripcion, categoria, duracion_horas, costo, fecha_inicio, fecha_fin, ciudad, modalidad, capacitador_id, estado, codigo_curso, fecha_creacion, fecha_actualizacion)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        """, titulo, descripcion, categoria, duracion, costo, fecha_inicio.date(), fecha_fin.date(), ciudad, modalidad, capacitador_id, estado, codigo_curso, datetime.utcnow(), datetime.utcnow())
    
    print(f"✓ {cantidad} cursos creados exitosamente")


async def crear_participantes(conn, cantidad: int = 150):
    """Crear participantes de prueba"""
    print(f"Creando {cantidad} participantes...")
    
    # Obtener clientes existentes
    clientes = await conn.fetch("SELECT id FROM aaces.clientes")
    
    if not clientes:
        print("⚠️ No hay clientes, creando participantes sin cliente")
        clientes = [{"id": None}]
    
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
        cliente_id = random.choice(clientes)["id"] if clientes[0]["id"] else None
        
        await conn.execute("""
            INSERT INTO aaces.participantes (nombre, apellido, correo, telefono, tipo_documento, numero_documento, fecha_nacimiento, genero, ciudad, cliente_id, fecha_creacion, fecha_actualizacion)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        """, nombre, apellido, correo, telefono, tipo_documento, numero_documento, fecha_nacimiento, genero, ciudad, cliente_id, datetime.utcnow(), datetime.utcnow())
    
    print(f"✓ {cantidad} participantes creados exitosamente")


async def crear_inscripciones_cursos(conn):
    """Crear inscripciones de participantes a cursos"""
    print("Creando inscripciones a cursos...")
    
    # Obtener cursos activos y participantes
    cursos = await conn.fetch("SELECT id, costo FROM aaces.cursos WHERE estado = 'activo'")
    participantes = await conn.fetch("SELECT id, cliente_id FROM aaces.participantes")
    
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
            existing = await conn.fetchrow("""
                SELECT id FROM aaces.curso_participante 
                WHERE curso_id = $1 AND participante_id = $2
            """, curso["id"], participante["id"])
            
            if not existing:
                nota_final = random.uniform(0, 10) if random.random() > 0.1 else None  # 90% tienen nota
                acreditado = nota_final is not None and nota_final >= 7.0
                
                fecha_emision = datetime.utcnow() if acreditado else None
                fecha_expiracion = (datetime.utcnow() + timedelta(days=1095)).date() if acreditado else None
                
                # Generar código de validación único
                codigo_validacion = f"VAL-{random.randint(100000, 999999)}"
                
                await conn.execute("""
                    INSERT INTO aaces.curso_participante (curso_id, participante_id, fecha_inscripcion, estado_pago, monto_pagado, nota_final, porcentaje_asistencia, acreditado, fecha_emision_certificado, fecha_expiracion_certificado, codigo_validacion, fecha_creacion, fecha_actualizacion)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                """, 
                curso["id"], participante["id"], datetime.utcnow() - timedelta(days=random.randint(1, 30)), 
                random.choice(ESTADOS_PAGO), curso["costo"] if random.random() > 0.2 else curso["costo"] * 0.5, 
                nota_final, random.uniform(60, 100) if nota_final else None, acreditado, 
                fecha_emision, fecha_expiracion, codigo_validacion, datetime.utcnow(), datetime.utcnow())
                
                inscripciones_creadas += 1
    
    print(f"✓ {inscripciones_creadas} inscripciones creadas exitosamente")


async def crear_pagos(conn):
    """Crear pagos para las inscripciones"""
    print("Creando pagos...")
    
    # Obtener inscripciones pagadas
    inscripciones = await conn.fetch("""
        SELECT cp.id, cp.participante_id, cp.monto_pagado, p.cliente_id 
        FROM aaces.curso_participante cp
        JOIN aaces.participantes p ON cp.participante_id = p.id
        WHERE cp.estado_pago = 'pagado'
    """)
    
    if not inscripciones:
        print("⚠️ No hay inscripciones pagadas")
        return
    
    pagos_creados = 0
    
    for inscripcion in inscripciones:
        # Crear entre 1 y 3 pagos por inscripción pagada
        num_pagos = random.randint(1, 3)
        monto_total = float(inscripcion["monto_pagado"])
        monto_por_pago = monto_total / num_pagos
        
        for i in range(num_pagos):
            await conn.execute("""
                INSERT INTO aaces.pagos (curso_participante_id, cliente_id, monto, tipo_pago, metodo_pago, fecha_pago, estado_pago, referencia_pago, notas, fecha_creacion, fecha_actualizacion)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            """, 
            inscripcion["id"], inscripcion["cliente_id"], monto_por_pago, 
            random.choice(TIPOS_PAGO), random.choice(METODOS_PAGO), 
            datetime.utcnow() - timedelta(days=random.randint(1, 60)), 
            "completado", f"REF-{random.randint(10000, 99999)}", 
            f"Pago {i+1} de {num_pagos}", datetime.utcnow(), datetime.utcnow())
            
            pagos_creados += 1
    
    print(f"✓ {pagos_creados} pagos creados exitosamente")


async def main():
    """Función principal para poblar la base de datos"""
    print("🚀 Iniciando poblamiento de base de datos AACES...")
    print("=" * 50)
    
    conn = None
    try:
        # Conectar a la base de datos
        conn = await asyncpg.connect(DATABASE_URL)
        print("✓ Conexión a base de datos establecida")
        
        # Crear clientes
        await crear_clientes(conn, 15)
        
        # Crear capacitadores
        await crear_capacitadores(conn, 10)
        
        # Crear cursos
        await crear_cursos(conn, 40)
        
        # Crear participantes
        await crear_participantes(conn, 150)
        
        # Crear inscripciones
        await crear_inscripciones_cursos(conn)
        
        # Crear pagos
        await crear_pagos(conn)
        
        # Obtener estadísticas finales
        clientes_count = await conn.fetchval("SELECT COUNT(*) FROM aaces.clientes")
        capacitadores_count = await conn.fetchval("SELECT COUNT(*) FROM aaces.capacitadores")
        cursos_count = await conn.fetchval("SELECT COUNT(*) FROM aaces.cursos")
        participantes_count = await conn.fetchval("SELECT COUNT(*) FROM aaces.participantes")
        inscripciones_count = await conn.fetchval("SELECT COUNT(*) FROM aaces.curso_participante")
        pagos_count = await conn.fetchval("SELECT COUNT(*) FROM aaces.pagos")
        
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
        raise
    finally:
        if conn:
            await conn.close()


if __name__ == "__main__":
    asyncio.run(main())