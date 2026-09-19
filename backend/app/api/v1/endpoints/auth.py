from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, text
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from uuid import UUID

from app.core.database import get_db
from app.core.config import settings
from app.models import Cliente, UsuarioPlataforma, Usuario
from app.schemas import LoginRequest, Token, ClienteResponse, ClienteUpdate, PlataformaUserResponse
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
    """Login de usuario con email y contraseña - Nuevo flujo 2 tablas"""
    try:
        logger.debug(f"Login DEBUG={settings.DEBUG} DEV_BYPASS={getattr(settings, 'ALLOW_DEV_LOGIN', False)}")
        
        # Nuevo flujo: autenticación determinística 2 tablas
        # Retorna (user_obj, source) donde source = "plataforma" | "usuario"
        user, source = await auth_service.authenticate_user(db, request.correo, request.password)
        
        # Dev fallback removido - solo autenticación real de BD
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
        
        # Verificar si el usuario está bloqueado (en BD ya se manejó, pero doble check)
        bh = getattr(user, "bloqueado_hasta", None)
        if bh and bh > datetime.now(timezone.utc):
            audit_logger.log_system_event(
                "blocked_login",
                "Account temporarily blocked",
                {"user_id": str(user.id), "email": request.correo, "blocked_until": user.bloqueado_hasta.isoformat()}
            )
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=f"Cuenta bloqueada hasta {user.bloqueado_hasta.strftime('%Y-%m-%d %H:%M')}"
            )
        
        # Determinar rol según source
        if source == "plataforma":
            # Usuario de plataforma (super_admin)
            role = Role.ADMIN
            org_id = None
            category = "super_admin"
        else:
            # Usuario de organización (admin/staff)
            role = user.rol if user.rol == "admin" else Role.CLIENT
            org_id = str(user.organizacion_id) if user.organizacion_id else None
            category = user.rol
        
        # Crear tokens JWT con claim 'source' OBLIGATORIO
        token_data = {
            "sub": str(user.id),
            "email": user.correo,
            "role": role,
            "name": user.nombre,
            "source": source,  # OBLIGATORIO
        }
        if org_id:
            token_data["org_id"] = org_id
        if category:
            token_data["category"] = category
        
        access_token = auth_service.create_access_token(data=token_data)
        
        refresh_token = auth_service.create_refresh_token(
            data={
                "sub": str(user.id),
                "email": user.correo,
                "role": role,
                "source": source,
            }
        )
        
        # Registrar login exitoso
        audit_logger.log_user_action(
            user_id=str(user.id),
            action="successful_login",
            resource="auth",
            details={"email": user.correo, "role": role, "source": source}
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
    """Refrescar token de acceso - Valida source claim"""
    try:
        token = credentials.credentials
        payload = auth_service.decode_token(token)
        
        if not payload or payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token de refresco inválido"
            )
        
        # Validar source claim en refresh token también
        source = payload.get("source")
        if source not in ("plataforma", "usuario"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token de refresco inválido: source claim faltante"
            )
        
        user_id = payload.get("sub")
        user = await auth_service.get_user_by_id(db, UUID(user_id), source)
        
        if not user or (hasattr(user, 'activo') and not user.activo) or (hasattr(user, 'estado') and user.estado != "activo"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Usuario no válido"
            )
        
        # Determinar role para nuevo token
        if source == "plataforma":
            role = Role.ADMIN
            category = "super_admin"
        else:
            role = user.rol if user.rol == "admin" else Role.CLIENT
            category = user.rol
        
        # Crear nuevo access token con source claim
        new_access_token = auth_service.create_access_token(
            data={
                "sub": str(user.id),
                "email": user.correo,
                "role": role,
                "name": user.nombre,
                "source": source,
                "category": category,
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


@router.get("/me")
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """Obtener información del usuario actual - DUAL response model"""
    try:
        token = credentials.credentials
        payload = auth_service.decode_token(token)
        
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido o expirado"
            )
        
        # Extraer source claim (validado en decode_token)
        source = payload.get("source")
        if source not in ("plataforma", "usuario"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido: source claim faltante"
            )
        
        user_id = payload.get("sub")
        user = await auth_service.get_user_by_id(db, UUID(user_id), source)
        
        logger.info(f"get_user_by_id({user_id}, source={source}) returned type: {type(user)}")
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuario no encontrado"
            )
        
        # DUAL RESPONSE MODEL según source
        if source == "plataforma":
            # Validar contra PlataformaUserResponse
            validated = PlataformaUserResponse.model_validate(user)
            logger.info(f"PlataformaUserResponse validation SUCCESS")
            return validated
        else:
            # Validar contra ClienteResponse (requiere org para vigencia_desde)
            from app.models import Organizacion
            org_result = await db.execute(
                select(Organizacion).where(Organizacion.id == user.organizacion_id)
            )
            org = org_result.scalar_one_or_none()
            
            response_data = auth_service._build_usuario_response(user, org)
            validated = ClienteResponse.model_validate(response_data)
            logger.info(f"ClienteResponse validation SUCCESS")
            return validated
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error obteniendo usuario actual: {e}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
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
        # Try usuarios first, then clientes
        r2 = await db.execute(text("UPDATE aaces.usuarios SET password_hash = :ph WHERE correo = :email"), {"ph": ph, "email": email})
        if r2.rowcount == 0:
            r2 = await db.execute(text("UPDATE aaces.clientes SET password_hash = :ph WHERE correo = :email"), {"ph": ph, "email": email})
        await db.commit()
        return {"updated": (r2.rowcount or 0)}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error en dev-reset-password: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error interno")


def determine_user_role(user: Cliente) -> str:
    """Determinar el rol del usuario basado en su email o categoría"""
    admin_emails = [
        "admin@aaces.com",
        "administrator@aaces.com", 
        "superadmin@aaces.com"
    ]
    
    if user.correo in admin_emails:
        return Role.ADMIN
    
    if user.categoria == "enterprise":
        return Role.CLIENT
    elif user.categoria == "premium":
        return Role.CLIENT
    else:
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
require_client = require_role([Role.ADMIN, Role.CLIENTE])
require_trainer = require_role([Role.ADMIN, Role.CLIENTE, Role.STAFF])
require_authenticated = require_role([Role.ADMIN, Role.CLIENTE, Role.STAFF])


async def require_superadmin(
    user_data: Dict[str, Any] = Depends(get_current_user_data)
):
    """Requerir super_admin de plataforma (source=plataforma, sin org_id)"""
    if user_data.get("source") != "plataforma":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere acceso de super administrador de plataforma"
        )
    return user_data


async def require_org_admin(
    user_data: Dict[str, Any] = Depends(get_current_user_data)
):
    """Requerir admin de organización (source=usuario, con org_id)"""
    if user_data.get("source") != "usuario":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere administrador de organización"
        )
    org_id = user_data.get("org_id")
    if not org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere una organización asociada al usuario"
        )
    return user_data


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
        source = data.get("source")
        
        # Solo usuarios de organización pueden actualizar perfil de cliente
        if source != "usuario":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo usuarios de organización")
        
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
        sql = f"UPDATE aaces.usuarios SET {', '.join(sets)}, fecha_actualizacion = NOW() WHERE id = :id"
        res = await db.execute(text(sql), params)
        await db.commit()
        return {"updated": int(res.rowcount or 0)}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error actualizando perfil: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error interno del servidor")


@router.post("/register")
async def register(
    payload: Dict[str, Any],
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Registro de nueva organización + administrador + suscripción"""
    try:
        org_data = payload.get("organizacion", {})
        admin_data = payload.get("admin", {})
        plan_codigo = (payload.get("plan") or "trial").strip().lower()

        rfc = (org_data.get("rfc") or "").strip().upper()
        razon_social = (org_data.get("razon_social") or "").strip()
        nombre_comercial = (org_data.get("nombre_comercial") or "").strip()
        estado = (org_data.get("estado") or "").strip()
        ciudad = (org_data.get("ciudad") or "").strip()

        admin_nombre = (admin_data.get("nombre") or "").strip()
        admin_correo = (admin_data.get("correo") or "").strip().lower()
        admin_password = admin_data.get("password") or ""

        if not rfc or not razon_social:
            raise HTTPException(status_code=400, detail="RFC y Razón Social son requeridos")
        if not admin_nombre or not admin_correo or not admin_password:
            raise HTTPException(status_code=400, detail="Nombre, correo y contraseña del administrador son requeridos")
        if len(admin_password) < 6:
            raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres")
        if "@" not in admin_correo:
            raise HTTPException(status_code=400, detail="Correo electrónico inválido")

        if plan_codigo not in ("trial", "profesional"):
            plan_codigo = "trial"

        await db.execute(text("SET LOCAL search_path TO aaces"))

        # Check RFC duplicado
        rfc_check = await db.execute(
            text("SELECT id FROM aaces.organizaciones WHERE rfc = :rfc LIMIT 1"),
            {"rfc": rfc}
        )
        if rfc_check.fetchone():
            raise HTTPException(status_code=409, detail="Ya existe una organización registrada con este RFC")

        # Check correo duplicado en usuarios
        email_check = await db.execute(
            text("SELECT id FROM aaces.usuarios WHERE correo = :correo LIMIT 1"),
            {"correo": admin_correo}
        )
        if email_check.fetchone():
            raise HTTPException(status_code=409, detail="Este correo ya está registrado")

        # Get plan
        plan_res = await db.execute(
            text("SELECT id FROM aaces.planes WHERE codigo = :codigo AND activo = true LIMIT 1"),
            {"codigo": plan_codigo}
        )
        plan_row = plan_res.fetchone()
        if not plan_row:
            raise HTTPException(status_code=400, detail="Plan no válido")

        plan_id = plan_row[0]

        # Create organization - activar automáticamente para trial
        org_estatus = 'activa' if plan_codigo == 'trial' else 'pendiente'
        org_id_res = await db.execute(
            text("""
                INSERT INTO aaces.organizaciones (rfc, razon_social, nombre_comercial, email_contacto, estado, ciudad, estatus, fecha_activacion)
                VALUES (:rfc, :razon_social, :nombre_comercial, :email_contacto, :estado, :ciudad, :estatus, 
                    CASE WHEN :estatus_val = 'activa' THEN CURRENT_TIMESTAMP ELSE NULL END)
                RETURNING id
            """),
            {
                "rfc": rfc, "razon_social": razon_social,
                "nombre_comercial": nombre_comercial or razon_social,
                "email_contacto": admin_correo,
                "estado": estado, "ciudad": ciudad,
                "estatus": org_estatus,
                "estatus_val": org_estatus,
            }
        )
        org_id = str(org_id_res.scalar())

        # Create admin user
        password_hash = auth_service.get_password_hash(admin_password)
        await db.execute(
            text("""
                INSERT INTO aaces.usuarios (organizacion_id, nombre, correo, password_hash, rol, activo)
                VALUES (:org_id, :nombre, :correo, :ph, 'admin', true)
            """),
            {"org_id": org_id, "nombre": admin_nombre, "correo": admin_correo, "ph": password_hash}
        )

        # Create subscription
        await db.execute(
            text("""
                INSERT INTO aaces.suscripciones (organizacion_id, plan_id, estatus, fecha_inicio, activada_por)
                VALUES (:org_id, :plan_id, 'activa', CURRENT_DATE, (SELECT id FROM aaces.usuarios WHERE correo = :correo))
            """),
            {"org_id": org_id, "plan_id": plan_id, "correo": admin_correo}
        )

        await db.commit()

        return {
            "organizacion_id": org_id,
            "admin_email": admin_correo,
            "plan": plan_codigo,
            "message": "Organización registrada. La suscripción está activa."
        }

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error en registro: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")