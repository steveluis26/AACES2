from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from fastapi import HTTPException, status, Depends
from app.core.config import settings
from types import SimpleNamespace
import logging

logger = logging.getLogger(__name__)

# Configuración de seguridad
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class Role:
    PUBLIC = "public"
    CLIENT = "client"
    ADMIN = "admin"
    TRAINER = "trainer"

class AuthService:
    """Servicio de autenticación con JWT y roles"""
    
    def __init__(self):
        self.pwd_context = pwd_context
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verificar contraseña contra hash"""
        try:
            return self.pwd_context.verify(plain_password, hashed_password)
        except Exception as e:
            logger.error(f"Error verificando contraseña: {e}")
            return False
    
    def get_password_hash(self, password: str) -> str:
        """Generar hash de contraseña"""
        return self.pwd_context.hash(password)
    
    def create_access_token(self, data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
        """Crear token de acceso JWT"""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        
        to_encode.update({"exp": expire, "type": "access"})
        encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        return encoded_jwt
    
    def create_refresh_token(self, data: Dict[str, Any]) -> str:
        """Crear token de refresco JWT"""
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)
        to_encode.update({"exp": expire, "type": "refresh"})
        encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        return encoded_jwt
    
    def decode_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Decodificar token JWT"""
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            return payload
        except JWTError as e:
            logger.error(f"Error decodificando token: {e}")
            return None
    
    async def authenticate_user(self, db: AsyncSession, email: str, password: str) -> Optional[SimpleNamespace]:
        """Autenticar usuario por email y contraseña (solo esquema aaces)"""
        try:
            result = await db.execute(
                text(
                    """
                    SELECT id, correo, nombre, categoria, estado, password_hash, bloqueado_hasta, intentos_fallidos
                    FROM aaces.clientes
                    WHERE correo = :email AND estado = 'activo'
                    LIMIT 1
                    """
                ),
                {"email": email}
            )
            row = result.fetchone()
            logger.debug(f"Auth aaces.clientes found: {bool(row)} for {email}")
            if row is None:
                return None

            user = SimpleNamespace(
                id=row[0], correo=row[1], nombre=row[2], categoria=row[3], estado=row[4],
                password_hash=row[5], bloqueado_hasta=row[6], intentos_fallidos=row[7]
            )

            if settings.DEBUG and settings.ALLOW_DEV_LOGIN:
                logger.debug("Dev login bypass (aaces.clientes)")
            elif not self.verify_password(password, user.password_hash):
                new_intentos = (user.intentos_fallidos or 0) + 1
                bloqueado = None
                if new_intentos >= 5:
                    bloqueado = datetime.utcnow() + timedelta(minutes=30)
                await db.execute(
                    text("UPDATE aaces.clientes SET intentos_fallidos = :i, bloqueado_hasta = :b WHERE id = :id"),
                    {"i": new_intentos, "b": bloqueado, "id": user.id}
                )
                await db.commit()
                return None

            if not (settings.DEBUG and settings.ALLOW_DEV_LOGIN):
                await db.execute(
                    text("UPDATE aaces.clientes SET intentos_fallidos = 0, bloqueado_hasta = NULL, ultimo_acceso = :ua WHERE id = :id"),
                    {"ua": datetime.utcnow(), "id": user.id}
                )
                await db.commit()

            return user
        except Exception as e:
            logger.error(f"Error en autenticación: {e}")
            return None
    
    async def get_user_by_id(self, db: AsyncSession, user_id: str) -> Optional[SimpleNamespace]:
        """Obtener usuario por ID (solo esquema aaces)"""
        try:
            result = await db.execute(
                text(
                    """
                    SELECT id, correo, nombre, categoria, estado,
                           ciudad_base, fecha_creacion, fecha_actualizacion,
                           ultimo_acceso, vigencia_desde, vigencia_hasta
                    FROM aaces.clientes
                    WHERE id = :id
                    LIMIT 1
                    """
                ),
                {"id": user_id}
            )
            row = result.fetchone()
            if row is None:
                return None
            return SimpleNamespace(
                id=row[0], correo=row[1], nombre=row[2], categoria=row[3], estado=row[4],
                ciudad_base=row[5], fecha_creacion=row[6], fecha_actualizacion=row[7],
                ultimo_acceso=row[8], vigencia_desde=row[9], vigencia_hasta=row[10]
            )
        except Exception as e:
            logger.error(f"Error obteniendo usuario: {e}")
            return None
    
    def check_user_role(self, user_data: Dict[str, Any], required_roles: List[str]) -> bool:
        """Verificar si el usuario tiene uno de los roles requeridos"""
        user_role = user_data.get("role", Role.PUBLIC)
        return user_role in required_roles
    
    def check_user_permission(self, user_data: Dict[str, Any], resource: str, action: str) -> bool:
        """Verificar permisos del usuario para un recurso específico"""
        user_role = user_data.get("role", Role.PUBLIC)
        user_id = user_data.get("sub")
        
        # Lógica de permisos basada en roles
        permissions = {
            Role.ADMIN: {
                "clientes": ["read", "write", "update", "delete"],
                "capacitadores": ["read", "write", "update", "delete"],
                "cursos": ["read", "write", "update", "delete"],
                "participantes": ["read", "write", "update", "delete"],
                "pagos": ["read", "write", "update", "delete"],
                "validaciones": ["read", "write", "update", "delete"],
                "dashboard": ["read"],
                "reports": ["read", "generate"],
            },
            Role.CLIENT: {
                "clientes": ["read", "update"],  # Solo su propio perfil
                "capacitadores": ["read", "write", "update"],
                "cursos": ["read", "write", "update"],
                "participantes": ["read", "write", "update"],
                "pagos": ["read", "write"],
                "validaciones": ["read"],
                "dashboard": ["read"],
                "reports": ["read"],
            },
            Role.TRAINER: {
                "cursos": ["read"],
                "participantes": ["read"],
                "validaciones": ["read"],
                "dashboard": ["read"],
            },
            Role.PUBLIC: {
                "validaciones": ["read"],  # Solo validación pública
            }
        }
        
        role_permissions = permissions.get(user_role, {})
        resource_permissions = role_permissions.get(resource, [])
        
        return action in resource_permissions

# Instancia global del servicio
auth_service = AuthService()
