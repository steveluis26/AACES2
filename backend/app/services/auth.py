from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List, Tuple
from uuid import UUID
from enum import Enum
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select
from app.core.config import settings
from app.errors import (
    DomainError,
    OrganizationPendingError,
    OrganizationSuspendedError,
    AccountBlockedError,
)
from app.models import UsuarioPlataforma, Usuario, Organizacion
import logging

logger = logging.getLogger(__name__)

# Configuración de seguridad
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class Role(str, Enum):
    """Roles de usuario en el sistema"""
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    STAFF = "staff"
    CLIENTE = "cliente"


class AuthService:
    """Servicio de autenticación con JWT y roles - Arquitectura 2 tablas"""

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
        """Crear token de acceso JWT con claim 'source' OBLIGATORIO"""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.now(timezone.utc) + expires_delta
        else:
            expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

        # source es OBLIGATORIO: "plataforma" | "usuario"
        source = data.get("source")
        if source not in ("plataforma", "usuario"):
            raise ValueError("Token debe incluir 'source': 'plataforma' | 'usuario'")

        to_encode.update({"exp": expire, "type": "access", "source": source})
        encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        return encoded_jwt

    def create_refresh_token(self, data: Dict[str, Any]) -> str:
        """Crear token de refresco JWT con claim 'source' OBLIGATORIO"""
        to_encode = data.copy()
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)

        source = data.get("source")
        if source not in ("plataforma", "usuario"):
            raise ValueError("Token debe incluir 'source': 'plataforma' | 'usuario'")

        to_encode.update({"exp": expire, "type": "refresh", "source": source})
        encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        return encoded_jwt

    def decode_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Decodificar token JWT y validar claim 'source'"""
        logger.info(f"decode_token called with token prefix: {token[:50]}...")
        logger.info(f"Using SECRET_KEY length: {len(settings.SECRET_KEY)}, ALGORITHM: {settings.ALGORITHM}")
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            
            # Validar claim 'source' OBLIGATORIO
            source = payload.get("source")
            if source not in ("plataforma", "usuario"):
                logger.error(f"Token inválido: source claim faltante o inválido: {source}")
                return None
            
            logger.info(f"decode_token SUCCESS: sub={payload.get('sub')}, source={source}, exp={payload.get('exp')}")
            return payload
        except JWTError as e:
            logger.error(f"decode_token JWTError: {type(e).__name__}: {e}")
            logger.error(f"Token prefix: {token[:50]}...")
            return None

    async def authenticate_user(self, db: AsyncSession, email: str, password: str) -> Tuple[Optional[Any], Optional[str]]:
        """
        Autenticar usuario - Flujo determinístico 2 tablas:
        1. Intentar usuarios_plataforma (source="plataforma")
        2. Intentar usuarios + organizaciones (source="usuario")
        Retorna: (user_object, source) o (None, None)
        """
        try:
            # 1. PRIMERO: platform user (sin organizacion_id, visión transversal)
            user = await self._authenticate_plataforma(db, email, password)
            if user:
                return user, "plataforma"

            # 2. SEGUNDO: org user (CON organizacion_id FK NOT NULL)
            user = await self._authenticate_usuario(db, email, password)
            if user:
                return user, "usuario"

            return None, None
        except DomainError:
            raise
        except Exception as e:
            logger.exception(f"Error en autenticación: {e}")
            return None, None

    async def _authenticate_plataforma(self, db: AsyncSession, email: str, password: str) -> Optional[UsuarioPlataforma]:
        """Autenticar contra usuarios_plataforma (super_admin)"""
        try:
            result = await db.execute(
                select(UsuarioPlataforma).where(
                    UsuarioPlataforma.correo == email,
                    UsuarioPlataforma.activo == True
                )
            )
            user = result.scalar_one_or_none()
            if user is None:
                return None

            if not self.verify_password(password, str(user.password_hash)):
                # Incrementar intentos fallidos
                user.intentos_fallidos = (user.intentos_fallidos or 0) + 1
                if user.intentos_fallidos >= 5:
                    user.bloqueado_hasta = datetime.now(timezone.utc) + timedelta(minutes=30)
                await db.commit()
                return None

            # Resetear intentos en éxito
            user.intentos_fallidos = 0
            user.bloqueado_hasta = None
            user.ultimo_acceso = datetime.now(timezone.utc)
            await db.commit()

            return user
        except Exception as e:
            logger.error(f"Error autenticando plataforma: {e}")
            return None

    async def _authenticate_usuario(self, db: AsyncSession, email: str, password: str) -> Optional[Usuario]:
        """Autenticar contra usuarios + organizaciones (admin/staff de org)"""
        try:
            result = await db.execute(
                select(Usuario, Organizacion)
                .join(Organizacion, Usuario.organizacion_id == Organizacion.id)
                .where(
                    Usuario.correo == email,
                    Usuario.activo == True,
                    Organizacion.estatus == "activa"
                )
            )
            row = result.first()
            if row is None:
                return None

            user, org = row

            if not self.verify_password(password, user.password_hash):
                user.intentos_fallidos = (user.intentos_fallidos or 0) + 1
                if user.intentos_fallidos >= 5:
                    user.bloqueado_hasta = datetime.now(timezone.utc) + timedelta(minutes=30)
                await db.commit()
                return None

            # Validar estado organización
            if org.estatus == "pendiente":
                raise OrganizationPendingError("Tu cuenta está pendiente de activación por el administrador")
            if org.estatus in ("suspendida", "cancelada"):
                raise OrganizationSuspendedError("Tu organización ha sido suspendida/cancelada. Contacta al administrador.")

            # Resetear intentos en éxito
            user.intentos_fallidos = 0
            user.bloqueado_hasta = None
            user.ultimo_acceso = datetime.now(timezone.utc)
            await db.commit()

            return user
        except DomainError:
            raise
        except Exception as e:
            logger.error(f"Error autenticando usuario: {e}")
            return None

    async def get_user_by_id(self, db: AsyncSession, user_id: UUID, source: str) -> Optional[Any]:
        """
        Obtener usuario por ID y source - SOURCE ES REQUERIDO
        source="plataforma" -> usuarios_plataforma
        source="usuario" -> usuarios + join organizaciones (solo activas)
        """
        try:
            logger.info(f"get_user_by_id called with user_id={user_id}, source={source}")

            if source == "plataforma":
                result = await db.execute(
                    select(UsuarioPlataforma).where(
                        UsuarioPlataforma.id == user_id,
                        UsuarioPlataforma.activo == True
                    )
                )
                return result.scalar_one_or_none()

            elif source == "usuario":
                result = await db.execute(
                    select(Usuario, Organizacion)
                    .join(Organizacion, Usuario.organizacion_id == Organizacion.id)
                    .where(
                        Usuario.id == user_id,
                        Usuario.activo == True,
                        Organizacion.estatus == "activa"
                    )
                )
                row = result.first()
                return row[0] if row else None

            else:
                logger.error(f"Source inválido: {source}")
                return None

        except Exception as e:
            logger.error(f"Error obteniendo usuario: {e}")
            return None

    def _map_rol_to_categoria(self, rol: str) -> str:
        """Mapear rol de usuario a categoria para ClienteResponse"""
        rol_map = {
            "admin": "enterprise",
            "staff": "premium",
            "super_admin": "enterprise",
        }
        return rol_map.get(rol, "basico")

    def _build_plataforma_response(self, user: UsuarioPlataforma) -> Dict[str, Any]:
        """Construir response para platform user"""
        return {
            "id": user.id,
            "nombre": user.nombre,
            "correo": user.correo,
            "rol": user.rol,
            "activo": user.activo,
            "fecha_creacion": user.fecha_creacion,
            "fecha_actualizacion": user.fecha_actualizacion,
        }

    def _build_usuario_response(self, user: Usuario, org: Optional[Organizacion] = None) -> Dict[str, Any]:
        """Construir response para org user (mapea a ClienteResponse)"""
        return {
            "id": user.id,
            "organizacion_id": user.organizacion_id,
            "nombre": user.nombre,
            "correo": user.correo,
            "ciudad_base": None,
            "categoria": self._map_rol_to_categoria(str(user.rol)),
            "estado": "activo" if user.activo else "inactivo",
            "fecha_creacion": user.fecha_creacion,
            "fecha_actualizacion": user.fecha_actualizacion,
            "ultimo_acceso": user.ultimo_acceso,
            "vigencia_desde": org.fecha_activacion.date() if org and org.fecha_activacion else None,
            "vigencia_hasta": None,
            "plan": "trial",
            "cursos_creados": 0,
            "cursos_max": 10,
            "descuento_pct": 0,
        }

    def check_user_role(self, user_data: Dict[str, Any], required_roles: List[str]) -> bool:
        """Verificar si el usuario tiene uno de los roles requeridos"""
        user_role = user_data.get("role", "public")
        return user_role in required_roles

    def check_user_permission(self, user_data: Dict[str, Any], resource: str, action: str) -> bool:
        """Verificar permisos del usuario para un recurso específico"""
        user_role = user_data.get("role", "public")
        user_id = user_data.get("sub")

        permissions = {
            "admin": {
                "clientes": ["read", "write", "update", "delete"],
                "capacitadores": ["read", "write", "update", "delete"],
                "cursos": ["read", "write", "update", "delete"],
                "participantes": ["read", "write", "update", "delete"],
                "pagos": ["read", "write", "update", "delete"],
                "validaciones": ["read", "write", "update", "delete"],
                "dashboard": ["read"],
                "reports": ["read", "generate"],
            },
            "client": {
                "clientes": ["read", "update"],
                "capacitadores": ["read", "write", "update"],
                "cursos": ["read", "write", "update"],
                "participantes": ["read", "write", "update"],
                "pagos": ["read", "write"],
                "validaciones": ["read"],
                "dashboard": ["read"],
                "reports": ["read"],
            },
            "trainer": {
                "cursos": ["read"],
                "participantes": ["read"],
                "validaciones": ["read"],
                "dashboard": ["read"],
            },
            "public": {
                "validaciones": ["read"],
            }
        }

        role_permissions = permissions.get(user_role, {})
        resource_permissions = role_permissions.get(resource, [])

        return action in resource_permissions


# Instancia global del servicio
auth_service = AuthService()