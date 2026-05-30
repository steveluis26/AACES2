from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text, select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker
from typing import Dict, Any
import datetime
import psutil
import os

from app.db.database import get_db, engine
from app.models.cliente import Cliente
from app.models.emprendimiento import Emprendimiento
from app.models.pago import Pago
from app.models.suscripcion import Suscripcion

router = APIRouter()

@router.get("/database")
async def database_health(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """
    Endpoint de diagnóstico completo para la base de datos
    """
    start_time = datetime.datetime.utcnow()
    
    try:
        # 1. Verificar conexión a PostgreSQL
        result = await db.execute(text("SELECT version()"))
        pg_version = result.scalar()
        
        # 2. Verificar tablas y contar registros
        tables_info = {}
        
        # Clientes
        result = await db.execute(select(func.count(Cliente.id)))
        clientes_count = result.scalar()
        tables_info["clientes"] = clientes_count
        
        # Emprendimientos
        result = await db.execute(select(func.count(Emprendimiento.id)))
        emprendimientos_count = result.scalar()
        tables_info["emprendimientos"] = emprendimientos_count
        
        # Pagos
        result = await db.execute(select(func.count(Pago.id)))
        pagos_count = result.scalar()
        tables_info["pagos"] = pagos_count
        
        # Suscripciones
        result = await db.execute(select(func.count(Suscripcion.id)))
        suscripciones_count = result.scalar()
        tables_info["suscripciones"] = suscripciones_count
        
        # 3. Verificar usuarios de prueba
        test_users = {}
        
        # Admin user
        result = await db.execute(
            select(Cliente).where(Cliente.email == "admin@aaces.com")
        )
        admin_user = result.scalar_one_or_none()
        
        if admin_user:
            test_users["admin@aaces.com"] = {
                "exists": True,
                "id": admin_user.id,
                "nombre": f"{admin_user.nombre} {admin_user.apellido}",
                "rol": admin_user.rol,
                "activo": admin_user.activo,
                "email_verificado": admin_user.email_verificado,
                "created_at": admin_user.created_at.isoformat() if admin_user.created_at else None
            }
        else:
            test_users["admin@aaces.com"] = {"exists": False}
        
        # Cliente user
        result = await db.execute(
            select(Cliente).where(Cliente.email == "cliente1@example.com")
        )
        cliente_user = result.scalar_one_or_none()
        
        if cliente_user:
            test_users["cliente1@example.com"] = {
                "exists": True,
                "id": cliente_user.id,
                "nombre": f"{cliente_user.nombre} {cliente_user.apellido}",
                "rol": cliente_user.rol,
                "activo": cliente_user.activo,
                "email_verificado": cliente_user.email_verificado,
                "created_at": cliente_user.created_at.isoformat() if cliente_user.created_at else None
            }
        else:
            test_users["cliente1@example.com"] = {"exists": False}
        
        # 4. Verificar últimos usuarios
        result = await db.execute(
            select(Cliente).order_by(Cliente.created_at.desc()).limit(5)
        )
        recent_users = result.scalars().all()
        
        recent_users_info = []
        for user in recent_users:
            recent_users_info.append({
                "id": user.id,
                "email": user.email,
                "nombre": f"{user.nombre} {user.apellido}",
                "rol": user.rol,
                "activo": user.activo,
                "created_at": user.created_at.isoformat() if user.created_at else None
            })
        
        # 5. Información del sistema
        db_size_result = await db.execute(text("SELECT pg_database_size(current_database())"))
        db_size = db_size_result.scalar()
        
        # 6. Tiempo de respuesta
        end_time = datetime.datetime.utcnow()
        response_time = (end_time - start_time).total_seconds()
        
        return {
            "status": "healthy",
            "timestamp": start_time.isoformat(),
            "response_time_seconds": response_time,
            "database": {
                "connected": True,
                "version": pg_version,
                "size_bytes": db_size,
                "size_mb": round(db_size / 1024 / 1024, 2)
            },
            "tables": tables_info,
            "test_users": test_users,
            "recent_users": recent_users_info,
            "summary": {
                "total_users": clientes_count,
                "total_emprendimientos": emprendimientos_count,
                "total_pagos": pagos_count,
                "total_suscripciones": suscripciones_count
            }
        }
        
    except Exception as e:
        return {
            "status": "unhealthy",
            "timestamp": start_time.isoformat(),
            "error": str(e),
            "database": {
                "connected": False,
                "error": str(e)
            }
        }

@router.get("/system")
async def system_health() -> Dict[str, Any]:
    """
    Endpoint de diagnóstico del sistema completo
    """
    try:
        # Información del sistema
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        # Información del entorno
        env_info = {
            "environment": os.getenv("ENVIRONMENT", "development"),
            "debug": os.getenv("DEBUG", "false").lower() == "true",
            "database_url_configured": bool(os.getenv("DATABASE_URL")),
            "secret_key_configured": bool(os.getenv("SECRET_KEY")),
            "backend_cors_origins": os.getenv("BACKEND_CORS_ORIGINS", "not set")
        }
        
        return {
            "status": "healthy",
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "system": {
                "cpu_percent": cpu_percent,
                "memory_percent": memory.percent,
                "memory_available_gb": round(memory.available / 1024 / 1024 / 1024, 2),
                "disk_percent": disk.percent,
                "disk_free_gb": round(disk.free / 1024 / 1024 / 1024, 2)
            },
            "environment": env_info
        }
        
    except Exception as e:
        return {
            "status": "unhealthy",
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "error": str(e)
        }

@router.get("/full")
async def full_health_check(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """
    Diagnóstico completo de todo el sistema
    """
    db_health = await database_health(db)
    sys_health = await system_health()
    
    overall_status = "healthy"
    if db_health.get("status") != "healthy" or sys_health.get("status") != "healthy":
        overall_status = "unhealthy"
    
    return {
        "status": overall_status,
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "database": db_health,
        "system": sys_health,
        "summary": {
            "database_status": db_health.get("status"),
            "system_status": sys_health.get("status"),
            "total_users": db_health.get("summary", {}).get("total_users", 0),
            "database_connected": db_health.get("database", {}).get("connected", False)
        }
    }

@router.get("/quick")
async def quick_health() -> Dict[str, Any]:
    """
    Chequeo rápido de salud básico
    """
    return {
        "status": "healthy",
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "message": "API está funcionando"
    }