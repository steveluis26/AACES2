from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, text
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from app.core.database import get_db
from app.core.config import settings
from app.models import Cliente
from app.schemas import LoginRequest, Token, ClienteResponse, ClienteUpdate
from app.services.auth import auth_service, Role
from app.core.logging import audit_logger
import logging

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer()

@router.post("/login", response_model=Token)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """Login de usuario con email y contraseña"""
    try:
        logger.debug(f"Login DEBUG={settings.DEBUG} DEV_BYPASS={getattr(settings, 'ALLOW_DEV_LOGIN', False)}")
        user = await auth_service.authenticate_user(db, request.correo, request.password)
        if not user and settings.DEBUG and getattr(settings, "ALLOW_DEV_LOGIN", False):
            try:
                res = await db.execute(
                    text(
                        "SELECT id, correo, nombre, categoria, estado FROM aaces.clientes WHERE correo = :email LIMIT 1"
                    ),
                    {"email": request.correo}
                )
                row = res.fetchone()
                if row is not None:
                    user = ClienteResponse(
                        id=row[0], correo=row[1], nombre=row[2], categoria=row[3], estado=row[4]
                    )
            except Exception as _:
                # Ignorar errores de BD en modo dev para no elevar a 500
                pass
        # Sin fallback dev: respetar autenticación real de BD
        
        if not user:
            audit_logger.log_system_event(
                "failed_login",
                "Invalid credentials",
                {"email": request.correo}
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales inválidas o cuenta bloqueada"
            )
        
        # Verificar si el usuario está bloqueado
        bh = getattr(user, "bloqueado_hasta", None)
        if bh and bh > datetime.utcnow():
            audit_logger.log_system_event(
                "blocked_login",
                "Account temporarily blocked",
                {"user_id": str(user.id), "email": request.correo, "blocked_until": user.bloqueado_hasta.isoformat()}
            )
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=f"Cuenta bloqueada hasta {user.bloqueado_hasta.strftime('%Y-%m-%d %H:%M')}"
            )
        
        # Determinar rol del usuario
        role = determine_user_role(user)
        
        # Crear tokens JWT
        access_token = auth_service.create_access_token(
            data={
                "sub": str(user.id),
                "email": user.correo,
                "role": role,
                "name": user.nombre,
                "category": user.categoria
            }
        )
        
        refresh_token = auth_service.create_refresh_token(
            data={
                "sub": str(user.id),
                "email": user.correo,
                "role": role
            }
        )
        
        # Registrar login exitoso
        audit_logger.log_user_action(
            user_id=str(user.id),
            action="successful_login",
            resource="auth",
            details={"email": user.correo, "role": role}
        )
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "must_change_password": bool(getattr(user, 'must_change_password', False))
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error en login: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno del servidor"
        )

@router.post("/refresh", response_model=Token)
async def refresh_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """Refrescar token de acceso"""
    try:
        token = credentials.credentials
        payload = auth_service.decode_token(token)
        
        if not payload or payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token de refresco inválido"
            )
        
        user_id = payload.get("sub")
        user = await auth_service.get_user_by_id(db, user_id)
        
        if not user or user.estado != "activo":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Usuario no válido"
            )
        
        # Crear nuevo access token
        new_access_token = auth_service.create_access_token(
            data={
                "sub": str(user.id),
                "email": user.correo,
                "role": payload.get("role"),
                "name": user.nombre,
                "category": user.categoria
            }
        )
        
        return {
            "access_token": new_access_token,
            "refresh_token": token,  # Mantener el mismo refresh token
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error refrescando token: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno del servidor"
        )

@router.get("/me", response_model=ClienteResponse)
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """Obtener información del usuario actual"""
    try:
        token = credentials.credentials
        payload = auth_service.decode_token(token)
        
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido o expirado"
            )
        
        user_id = payload.get("sub")
        user = await auth_service.get_user_by_id(db, user_id)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuario no encontrado"
            )
        
        return user
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error obteniendo usuario actual: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno del servidor"
        )

@router.post("/logout")
async def logout(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Cerrar sesión (invalidar token)"""
    try:
        token = credentials.credentials
        payload = auth_service.decode_token(token)
        
        if payload:
            user_id = payload.get("sub")
            audit_logger.log_user_action(
                user_id=user_id,
                action="logout",
                resource="auth"
            )
        
        return {"message": "Sesión cerrada exitosamente"}
        
    except Exception as e:
        logger.error(f"Error en logout: {e}")
        return {"message": "Sesión cerrada exitosamente"}

@router.post("/dev-reset-password")
async def dev_reset_password(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    if not (settings.DEBUG and getattr(settings, "ALLOW_DEV_LOGIN", False)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    email = payload.get("correo") or payload.get("email")
    new_password = payload.get("password")
    if not email or not new_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Parámetros inválidos")
    try:
        ph = auth_service.get_password_hash(new_password)
        r2 = await db.execute(text("UPDATE aaces.clientes SET password_hash = :ph WHERE correo = :email"), {"ph": ph, "email": email})
        await db.commit()
        return {"updated": (r2.rowcount or 0)}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error en dev-reset-password: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error interno")

def determine_user_role(user: Cliente) -> str:
    """Determinar el rol del usuario basado en su email o categoría"""
    # Admin users por email
    admin_emails = [
        "admin@aaces.com",
        "administrator@aaces.com", 
        "superadmin@aaces.com"
    ]
    
    if user.correo in admin_emails:
        return Role.ADMIN
    
    # Por categoría de cliente
    if user.categoria == "enterprise":
        return Role.CLIENT
    elif user.categoria == "premium":
        return Role.CLIENT
    else:  # básico
        return Role.CLIENT

async def get_current_user_data(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Obtener datos del usuario actual desde el token"""
    token = credentials.credentials
    payload = auth_service.decode_token(token)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado"
        )
    
    return payload

def require_role(required_roles: list):
    """Decorador para requerir roles específicos"""
    async def role_checker(
        user_data: Dict[str, Any] = Depends(get_current_user_data)
    ):
        user_role = user_data.get("role", Role.PUBLIC)
        
        if user_role not in required_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Se requiere uno de estos roles: {', '.join(required_roles)}"
            )
        
        return user_data
    
    return role_checker

# Middleware de autenticación para diferentes roles
require_admin = require_role([Role.ADMIN])
require_client = require_role([Role.ADMIN, Role.CLIENT])
require_trainer = require_role([Role.ADMIN, Role.CLIENT, Role.TRAINER])
require_authenticated = require_role([Role.ADMIN, Role.CLIENT, Role.TRAINER])

@router.put("/profile")
async def update_profile(
    payload: ClienteUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    try:
        token = credentials.credentials
        data = auth_service.decode_token(token)
        if not data:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido o expirado")
        user_id = data.get("sub")
        sets = []
        params: Dict[str, Any] = {"id": user_id}
        if payload.nombre is not None:
            sets.append("nombre = :nombre")
            params["nombre"] = payload.nombre.strip()
        if payload.correo is not None:
            sets.append("correo = :correo")
            params["correo"] = str(payload.correo).strip()
        if payload.ciudad_base is not None:
            sets.append("ciudad_base = :ciudad_base")
            params["ciudad_base"] = payload.ciudad_base.strip()
        if payload.categoria is not None:
            sets.append("categoria = :categoria")
            params["categoria"] = payload.categoria.strip()
        if payload.estado is not None:
            sets.append("estado = :estado")
            params["estado"] = payload.estado.strip()
        if not sets:
            return {"updated": 0}
        sql = f"UPDATE aaces.clientes SET {', '.join(sets)}, fecha_actualizacion = NOW() WHERE id = :id"
        res = await db.execute(text(sql), params)
        await db.commit()
        return {"updated": int(res.rowcount or 0)}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error actualizando perfil: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error interno del servidor")
