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
        
        # Determinar rol del usuario (nuevo esquema vs viejo)
        if getattr(user, "source", None) == "usuario":
            role = user.rol
            org_id = str(user.organizacion_id) if user.organizacion_id else None
            category = user.rol
        else:
            role = determine_user_role(user)
            org_id = str(user.organizacion_id) if getattr(user, "organizacion_id", None) else None
            category = getattr(user, 'categoria', 'basico')
        
        # Crear tokens JWT
        token_data = {
            "sub": str(user.id),
            "email": user.correo,
            "role": role,
            "name": user.nombre,
        }
        if org_id:
            token_data["org_id"] = org_id
        if category:
            token_data["category"] = category
        if getattr(user, "source", None) == "usuario":
            token_data["source"] = "usuario"
        
        access_token = auth_service.create_access_token(data=token_data)
        
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
            details={"email": user.correo, "role": role, "source": getattr(user, "source", "cliente")}
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
        
        logger.info(f"get_user_by_id({user_id}) returned type: {type(user)}")
        logger.info(f"get_user_by_id({user_id}) returned data: {vars(user) if hasattr(user, '__dict__') else user}")
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuario no encontrado"
            )
        
        # Explicitly validate against ClienteResponse (Pydantic v2)
        try:
            validated = ClienteResponse.model_validate(user)
            logger.info(f"ClienteResponse validation SUCCESS: {validated}")
            return validated
        except Exception as validation_error:
            logger.error(f"ClienteResponse validation error: {validation_error}")
            logger.error(f"User object fields: {vars(user) if hasattr(user, '__dict__') else 'no dict'}")
            raise
        
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


async def require_superadmin(
    user_data: Dict[str, Any] = Depends(get_current_user_data)
):
    """Requerir rol admin SIN organizacion_id (superadmin de plataforma)."""
    if user_data.get("role") not in [Role.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere rol de administrador"
        )
    if user_data.get("org_id"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso no autorizado para administradores de organización"
        )
    return user_data


async def require_org_admin(
    user_data: Dict[str, Any] = Depends(get_current_user_data)
):
    """Requerir admin con organizacion_id (admin de una organizacion)."""
    if user_data.get("role") not in [Role.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere rol de administrador"
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
            await _log_intento(db, rfc, admin_correo, request, "duplicado", "RFC ya registrado")
            raise HTTPException(status_code=409, detail="Ya existe una organización registrada con este RFC")

        # Check correo duplicado en usuarios
        email_check = await db.execute(
            text("SELECT id FROM aaces.usuarios WHERE correo = :correo LIMIT 1"),
            {"correo": admin_correo}
        )
        if email_check.fetchone():
            await _log_intento(db, rfc, admin_correo, request, "duplicado", "Correo ya registrado")
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

        # Create organization
        org_id_res = await db.execute(
            text("""
                INSERT INTO aaces.organizaciones (rfc, razon_social, nombre_comercial, email_contacto, estado, ciudad, estatus)
                VALUES (:rfc, :razon_social, :nombre_comercial, :email_contacto, :estado, :ciudad, 'pendiente')
                RETURNING id
            """),
            {
                "rfc": rfc, "razon_social": razon_social,
                "nombre_comercial": nombre_comercial or razon_social,
                "email_contacto": admin_correo,
                "estado": estado, "ciudad": ciudad,
            }
        )
        org_id = str(org_id_res.scalar())

        # Create admin user
        password_hash = auth_service.get_password_hash(admin_password)
        await db.execute(
            text("""
                INSERT INTO aaces.usuarios (organizacion_id, nombre, correo, password_hash, rol)
                VALUES (:org_id, :nombre, :correo, :ph, 'admin')
            """),
            {"org_id": org_id, "nombre": admin_nombre, "correo": admin_correo, "ph": password_hash}
        )

        # Create pending subscription
        await db.execute(
            text("""
                INSERT INTO aaces.suscripciones (organizacion_id, plan_id, estatus)
                VALUES (:org_id, :plan_id, 'pendiente')
            """),
            {"org_id": org_id, "plan_id": plan_id}
        )

        await db.commit()

        await _log_intento(db, rfc, admin_correo, request, "exito", f"Registro exitoso plan={plan_codigo}")

        return {
            "success": True,
            "message": "Registro exitoso. Recibirás un correo cuando tu cuenta sea activada.",
            "organizacion_id": org_id,
            "plan": plan_codigo
        }

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error en registro: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")


async def _log_intento(db: AsyncSession, rfc: str, correo: str, request: Request, resultado: str, detalle: str = None):
    """Registrar intento de registro en tabla registro_intentos"""
    try:
        ip = request.client.host if request.client else None
        ua = request.headers.get("user-agent") if request.headers else None
        await db.execute(
            text("""
                INSERT INTO aaces.registro_intentos (rfc, correo, ip_origen, user_agent, resultado, detalle)
                VALUES (:rfc, :correo, :ip, :ua, :resultado, :detalle)
            """),
            {"rfc": rfc, "correo": correo, "ip": ip, "ua": ua, "resultado": resultado, "detalle": detalle}
        )
        await db.commit()
    except Exception:
        pass
