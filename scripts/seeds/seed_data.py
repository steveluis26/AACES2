#!/usr/bin/env python3
"""
Script para poblar la base de datos AACES con datos de prueba
"""

import asyncio
import random
from datetime import datetime, timedelta, date
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
import sys
import os

# Añadir el directorio backend al path
sys.path.append(os.path.join(os.path.dirname(__file__), '../../backend'))

from app.models import Cliente, Capacitador, Curso, Participante, CursoParticipante, Pago
from app.core.security import get_password_hash

# Configuración de la base de datos
DATABASE_URL = "postgresql+asyncpg://aaces_user:aaces_password@172.20.0.3:5432/aaces_db"

engine = create_async_engine(DATABASE_URL, echo=True)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

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


async def crear_clientes(db: AsyncSession, cantidad: int = 15):
    """Crear clientes de prueba"""
    print(f"Creando {cantidad} clientes...")
    
    clientes = []
    for i in range(cantidad):
        nombre = random.choice(NOMBRES)
        apellido = random.choice(APELLIDOS)
        
        cliente = Cliente(
            nombre=f"{nombre} {apellido}",
            correo=generar_correo(nombre, apellido, f"cliente{i+1}"),
            password_hash=get_password_hash("password123"),
            ciudad_base=random.choice(CIUDADES),
            categoria=random.choice(CATEGORIAS_CLIENTE),
            estado="activo",
            fecha_creacion=datetime.utcnow(),
            fecha_actualizacion=datetime.utcnow()
        )
        
        db.add(cliente)
        clientes.append(cliente)
    
    await db.commit()
    print(f"✓ {cantidad} clientes creados exitosamente")
    return clientes


async def crear_capacitadores(db: AsyncSession, cantidad: int = 10):
    """Crear capacitadores de prueba"""
    print(f"Creando {cantidad} capacitadores...")
    
    capacitadores = []
    for i in range(cantidad):
        nombre = random.choice(NOMBRES)
        apellido = random.choice(APELLIDOS)
        
        capacitador = Capacitador(
            nombre=f"{nombre} {apellido}",
            correo=generar_correo(nombre, apellido, f"capacitador{i+1}"),
            telefono=f"09{random.randint(10000000, 99999999)}",
            especialidad=random.choice(ESPECIALIDADES),
            experiencia_anos=random.randint(2, 15),
            estado="activo",
            fecha_creacion=datetime.utcnow(),
            fecha_actualizacion=datetime.utcnow()
        )
        
        db.add(capacitador)
        capacitadores.append(capacitador)
    
    await db.commit()
    print(f"✓ {cantidad} capacitadores creados exitosamente")
    return capacitadores


async def crear_cursos(db: AsyncSession, capacitadores, cantidad: int = 40):
    """Crear cursos de prueba"""
    print(f"Creando {cantidad} cursos...")
    
    cursos = []
    fecha_base = datetime.utcnow()
    
    for i in range(cantidad):
        duracion = random.randint(8, 40)  # 8 a 40 horas
        costo = random.randint(50, 500)  # $50 a $500
        
        # Fechas del curso
        fecha_inicio = fecha_base + timedelta(days=random.randint(-30, 90))
        fecha_fin = fecha_inicio + timedelta(days=random.randint(1, 7))
        
        curso = Curso(
            titulo=f"Curso de {random.choice(ESPECIALIDADES)} {i+1}",
            descripcion=f"Descripción detallada del curso {i+1}. Aprenda las mejores prácticas y técnicas avanzadas.",
            categoria=random.choice(CATEGORIAS_CURSOS),
            duracion_horas=duracion,
            costo=costo,
            fecha_inicio=fecha_inicio.date(),
            fecha_fin=fecha_fin.date(),
            ciudad=random.choice(CIUDADES),
            modalidad=random.choice(MODALIDADES),
            capacitador_id=random.choice(capacitadores).id,
            estado=random.choice(ESTADOS_CURSO),
            fecha_creacion=datetime.utcnow(),
            fecha_actualizacion=datetime.utcnow()
        )
        
        db.add(curso)
        cursos.append(curso)
    
    await db.commit()
    print(f"✓ {cantidad} cursos creados exitosamente")
    return cursos


async def crear_participantes(db: AsyncSession, clientes, cantidad: int = 150):
    """Crear participantes de prueba"""
    print(f"Creando {cantidad} participantes...")
    
    participantes = []
    for i in range(cantidad):
        nombre = random.choice(NOMBRES)
        apellido = random.choice(APELLIDOS)
        
        participante = Participante(
            nombre=nombre,
            apellido=apellido,
            correo=generar_correo(nombre, apellido, f"participante{i+1}"),
            telefono=f"09{random.randint(10000000, 99999999)}",
            tipo_documento=random.choice(TIPOS_DOCUMENTO),
            numero_documento=f"{random.randint(1000000000, 9999999999)}",
            fecha_nacimiento=generar_fecha_nacimiento(),
            genero=random.choice(GENEROS),
            ciudad=random.choice(CIUDADES),
            cliente_id=random.choice(clientes).id,
            fecha_creacion=datetime.utcnow(),
            fecha_actualizacion=datetime.utcnow()
        )
        
        db.add(participante)
        participantes.append(participante)
    
    await db.commit()
    print(f"✓ {cantidad} participantes creados exitosamente")
    return participantes


async def crear_inscripciones_cursos(db: AsyncSession, cursos, participantes):
    """Crear inscripciones de participantes a cursos"""
    print("Creando inscripciones a cursos...")
    
    inscripciones = []
    for curso in cursos:
        if curso.estado == "activo":
            # Inscribir entre 3 y 15 participantes por curso activo
            num_participantes = random.randint(3, 15)
            participantes_seleccionados = random.sample(participantes, min(num_participantes, len(participantes)))
            
            for participante in participantes_seleccionados:
                # Verificar que el participante no esté ya inscrito en este curso
                existing = await db.execute(
                    select(CursoParticipante).where(
                        CursoParticipante.curso_id == curso.id,
                        CursoParticipante.participante_id == participante.id
                    )
                )
                
                if not existing.scalar_one_or_none():
                    nota_final = random.uniform(0, 10) if random.random() > 0.1 else None  # 90% tienen nota
                    acreditado = nota_final is not None and nota_final >= 7.0
                    
                    inscripcion = CursoParticipante(
                        curso_id=curso.id,
                        participante_id=participante.id,
                        fecha_inscripcion=datetime.utcnow() - timedelta(days=random.randint(1, 30)),
                        estado_pago=random.choice(ESTADOS_PAGO),
                        monto_pagado=curso.costo if random.random() > 0.2 else curso.costo * 0.5,  # 80% paga completo
                        nota_final=nota_final,
                        porcentaje_asistencia=random.uniform(60, 100) if nota_final else None,
                        acreditado=acreditado,
                        fecha_emision_certificado=datetime.utcnow() if acreditado else None,
                        fecha_expiracion_certificado=(datetime.utcnow() + timedelta(days=1095)).date() if acreditado else None,
                        fecha_creacion=datetime.utcnow(),
                        fecha_actualizacion=datetime.utcnow()
                    )
                    
                    db.add(inscripcion)
                    inscripciones.append(inscripcion)
    
    await db.commit()
    print(f"✓ {len(inscripciones)} inscripciones creadas exitosamente")
    return inscripciones


async def crear_pagos(db: AsyncSession, inscripciones, clientes):
    """Crear pagos para las inscripciones"""
    print("Creando pagos...")
    
    pagos = []
    for inscripcion in inscripciones:
        if inscripcion.estado_pago == "pagado":
            # Crear entre 1 y 3 pagos por inscripción pagada
            num_pagos = random.randint(1, 3)
            monto_total = inscripcion.monto_pagado
            monto_por_pago = monto_total / num_pagos
            
            for i in range(num_pagos):
                pago = Pago(
                    curso_participante_id=inscripcion.id,
                    cliente_id=inscripcion.participante.cliente_id,
                    monto=monto_por_pago,
                    tipo_pago=random.choice(TIPOS_PAGO),
                    metodo_pago=random.choice(METODOS_PAGO),
                    fecha_pago=datetime.utcnow() - timedelta(days=random.randint(1, 60)),
                    estado_pago="completado",
                    referencia_pago=f"REF-{random.randint(10000, 99999)}",
                    notas=f"Pago {i+1} de {num_pagos}",
                    fecha_creacion=datetime.utcnow(),
                    fecha_actualizacion=datetime.utcnow()
                )
                
                db.add(pago)
                pagos.append(pago)
    
    await db.commit()
    print(f"✓ {len(pagos)} pagos creados exitosamente")
    return pagos


async def main():
    """Función principal para poblar la base de datos"""
    print("🚀 Iniciando poblamiento de base de datos AACES...")
    print("=" * 50)
    
    async with AsyncSessionLocal() as db:
        try:
            # Crear clientes
            clientes = await crear_clientes(db, 15)
            
            # Crear capacitadores
            capacitadores = await crear_capacitadores(db, 10)
            
            # Crear cursos
            cursos = await crear_cursos(db, capacitadores, 40)
            
            # Crear participantes
            participantes = await crear_participantes(db, clientes, 150)
            
            # Crear inscripciones
            inscripciones = await crear_inscripciones_cursos(db, cursos, participantes)
            
            # Crear pagos
            await crear_pagos(db, inscripciones, clientes)
            
            print("\n" + "=" * 50)
            print("✅ Poblamiento completado exitosamente!")
            print(f"📊 Resumen:")
            print(f"   • Clientes: {len(clientes)}")
            print(f"   • Capacitadores: {len(capacitadores)}")
            print(f"   • Cursos: {len(cursos)}")
            print(f"   • Participantes: {len(participantes)}")
            print(f"   • Inscripciones: {len(inscripciones)}")
            
        except Exception as e:
            print(f"❌ Error durante el poblamiento: {str(e)}")
            await db.rollback()
            raise
        finally:
            await db.close()


if __name__ == "__main__":
    asyncio.run(main())