from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import logging

from app.core.config import settings
from app.core.database import get_db
from app.models import Cliente

logger = logging.getLogger(__name__)

# Security setup
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Generate password hash."""
    return pwd_context.hash(password)

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: Dict[str, Any]) -> str:
    """Create JWT refresh token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and verify JWT token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Get current authenticated user. Supports both old (clientes) and new (usuarios) schema."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        token = credentials.credentials
        payload = decode_token(token)
        if payload is None:
            raise credentials_exception
        
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception

        source = payload.get("source")
        
        if source == "usuario":
            # New schema: query from usuarios + organizaciones
            from sqlalchemy import text
            result = await db.execute(
                text("""
                    SELECT u.id, u.nombre, u.correo, u.rol, u.activo, u.organizacion_id,
                           o.estatus, o.razon_social
                    FROM aaces.usuarios u
                    JOIN aaces.organizaciones o ON o.id = u.organizacion_id
                    WHERE u.id = :id AND u.activo = true
                """),
                {"id": user_id}
            )
            row = result.fetchone()
            if row is None:
                raise credentials_exception
            return {
                "id": str(row[0]),
                "nombre": row[1],
                "correo": row[2],
                "rol": row[3],
                "activo": row[4],
                "organizacion_id": str(row[5]),
                "org_estatus": row[6],
                "razon_social": row[7],
                "source": "usuario",
            }
        
        # Old schema: query from clientes
        from sqlalchemy import select
        result = await db.execute(select(Cliente).where(Cliente.id == user_id))
        user = result.scalar_one_or_none()
        
        if user is None:
            raise credentials_exception
        
        if user.estado != "activo":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Inactive user"
            )
        
        return {
            "id": str(user.id),
            "correo": user.correo,
            "nombre": user.nombre,
            "categoria": user.categoria,
            "estado": user.estado,
            "organizacion_id": str(user.organizacion_id) if getattr(user, "organizacion_id", None) else None,
            "source": "cliente",
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"get_current_user error: {e}")
        raise credentials_exception

async def get_current_active_user(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Get current active user."""
    if current_user.get("estado") != "activo":
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

async def get_admin_user(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Get admin user (premium or enterprise)."""
    if current_user.get("categoria") not in ["premium", "enterprise"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user