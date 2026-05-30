from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor
from urllib.parse import urlparse
import os
import time
from datetime import datetime

from app.db.database import get_db
from app.core.config import settings

router = APIRouter()

def get_database_config():
    """Obtiene configuración de base de datos desde settings"""
    if settings.DATABASE_URL:
        parsed = urlparse(settings.DATABASE_URL)
        return {
            'host': parsed.hostname or 'localhost',
            'port': parsed.port or 5432,
            'database': parsed.path[1:] if parsed.path else 'aaces_db',
            'user': parsed.username or 'postgres',
            'password': parsed.password or 'postgres'
        }
    
    return {
        'host': settings.DB_HOST or 'localhost',
        'port': settings.DB_PORT or 5432,
        'database': settings.DB_NAME or 'aaces_db',
        'user': settings.DB_USER or 'postgres',
        'password': settings.DB_PASSWORD or 'postgres'
    }

def test_postgresql_connection():
    """Prueba la conexión directa a PostgreSQL"""
    config = get_database_config()
    start_time = time.time()
    
    try:
        conn = psycopg2.connect(**config)
        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        version = cursor.fetchone()[0]
        
        # Obtener estadísticas de la base de datos
        cursor.execute("""
            SELECT 
                count(*) as total_users,
                count(CASE WHEN is_active = true THEN 1 END) as active_users,
                count(CASE WHEN role = 'admin' THEN 1 END) as admin_users,
                count(CASE WHEN role = 'client' THEN 1 END) as client_users
            FROM users;
        """)
        stats = cursor.fetchone()
        
        # Verificar usuarios específicos
        cursor.execute("SELECT email, username, role, is_active FROM users WHERE email IN ('admin@aaces.com', 'cliente1@example.com');")
        test_users = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        connection_time = time.time() - start_time
        
        return {
            "connected": True,
            "connection_time_ms": round(connection_time * 1000, 2),
            "postgresql_version": version,
            "database_stats": {
                "total_users": stats[0],
                "active_users": stats[1],
                "admin_users": stats[2],
                "client_users": stats[3]
            },
            "test_users": [
                {
                    "email": user[0],
