#!/usr/bin/env python3
"""
Script para verificar y crear credenciales de prueba en la base de datos
"""

import sys
import os
sys.path.append('/Users/riquer/Documents/trae_projects/AACES/backend')

from sqlalchemy.orm import Session
from app.db.session import get_db_session
from app.models.user import User
from app.core.security import get_password_hash
from app.core.config import settings
import uuid

def verify_or_create_credentials():
    """Verifica y crea credenciales de prueba"""
    db = next(get_db_session())
    
    try:
        # Verificar credenciales de administrador
        admin_user = db.query(User).filter(User.email == "admin@aaces.com").first()
        if not admin_user:
            print("Creando usuario administrador...")
            admin_user = User(
                id=str(uuid.uuid4()),
                email="admin@aaces.com",
                hashed_password=get_password_hash("admin123"),
                full_name="Administrador AACES",
                role="admin",
                is_active=True,
                created_by="system"
            )
            db.add(admin_user)
            print("✓ Usuario administrador creado")
        else:
            print("✓ Usuario administrador ya existe")
        
        # Verificar credenciales de cliente
        client_user = db.query(User).filter(User.email == "cliente1@example.com").first()
        if not client_user:
            print("Creando usuario cliente...")
            client_user = User(
                id=str(uuid.uuid4()),
                email="cliente1@example.com",
                hashed_password=get_password_hash("cliente123"),
                full_name="Cliente de Prueba",
                role="client",
                is_active=True,
                created_by="system"
            )
            db.add(client_user)
            print("✓ Usuario cliente creado")
        else:
            print("✓ Usuario cliente ya existe")
        
        db.commit()
        print("\nCredenciales de prueba verificadas:")
        print("Admin: admin@aaces.com / admin123")
        print("Cliente: cliente1@example.com / cliente123")
        
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    verify_or_create_credentials()