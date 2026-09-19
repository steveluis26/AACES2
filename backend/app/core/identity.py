"""Identidad del usuario autenticado — Fase 1.

Contrato de identidad (válido en todo el backend):

- ``sub`` del JWT es SIEMPRE el ID del usuario
  (``usuarios.id`` o ``usuarios_plataforma.id``). Nunca es un
  ``organizacion_id`` ni un ``cliente_id``.
- La organización se resuelve desde la BD (``usuarios.organizacion_id``),
  que es la autoridad. El claim ``org_id`` del token es informativo.
- Las tablas legacy que aún usan ``cliente_id`` se resuelven mediante
  ``aaces.clientes.organizacion_id`` (puente creado en bootstrap),
  nunca a partir del ``sub``.

Usar ``get_current_identity`` en endpoints nuevos y migrar los existentes
(Fase 2). No usar ``user_data["sub"]`` como identificador de organización.
"""

from dataclasses import dataclass
from typing import Optional
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.auth import auth_service

security = HTTPBearer()


@dataclass(frozen=True)
class Identity:
    """Identidad validada del usuario autenticado.

    Attributes:
        user_id: ID del usuario (= JWT ``sub``). Siempre un user id.
        source: "plataforma" (super admin) | "usuario" (org).
        role: rol del claim del token.
        email: correo del claim (o del registro).
        org_id: ID de la organización resuelto desde la BD.
            None para usuarios de plataforma.
    """

    user_id: str
    source: str
    role: str
    email: Optional[str]
    org_id: Optional[str]


async def get_current_identity(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Identity:
    """Dependencia central de identidad.

    Decodifica el JWT, valida el claim ``source``, carga el usuario desde la BD
    y resuelve su organización desde ``usuarios.organizacion_id``.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales de autenticación no proporcionadas",
        )

    payload = auth_service.decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
        )

    source = payload.get("source")
    if source not in ("plataforma", "usuario"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido: source claim faltante",
        )

    try:
        user_id = UUID(str(payload.get("sub")))
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido: sub no es un UUID de usuario",
        )

    # get_user_by_id ya filtra usuarios inactivos y organizaciones no activas.
    user = await auth_service.get_user_by_id(db, user_id, source)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no válido, inactivo o sin organización activa",
        )

    org_id: Optional[str] = None
    if source == "usuario":
        raw_org = getattr(user, "organizacion_id", None)
        org_id = str(raw_org) if raw_org else None
        if not org_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="El usuario no tiene una organización asociada",
            )

    return Identity(
        user_id=str(user_id),
        source=source,
        role=str(payload.get("role") or getattr(user, "rol", "") or ""),
        email=payload.get("email") or getattr(user, "correo", None),
        org_id=org_id,
    )


async def get_current_cliente_id(
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db),
) -> str:
    """Resuelve el ``cliente_id`` legacy para la organización del usuario.

    Puente entre el modelo nuevo (``organizaciones``) y las tablas que aún
    referencian ``clientes.id``. Nunca deriva el cliente del ``sub``.
    """
    if not identity.org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere una organización asociada al usuario",
        )

    row = await db.execute(
        text("SELECT id FROM aaces.clientes WHERE organizacion_id = :org_id LIMIT 1"),
        {"org_id": identity.org_id},
    )
    rec = row.fetchone()
    if not rec:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="La organización no tiene cliente asociado (pendiente de activación)",
        )
    return str(rec[0])


def require_identity_roles(*allowed_roles: str):
    """Fábrica de dependencias que exigen uno de los roles sobre Identity."""

    async def role_checker(
        identity: Identity = Depends(get_current_identity),
    ) -> Identity:
        if identity.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Se requiere uno de estos roles: {', '.join(allowed_roles)}",
            )
        return identity

    return role_checker


async def require_platform_identity(
    identity: Identity = Depends(get_current_identity),
) -> Identity:
    """Exige super admin de plataforma (source=plataforma, sin org)."""
    if identity.source != "plataforma":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere acceso de super administrador de plataforma",
        )
    return identity


async def require_org_identity(
    identity: Identity = Depends(get_current_identity),
) -> Identity:
    """Exige usuario de organización con org_id resuelto desde la BD."""
    if identity.source != "usuario" or not identity.org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere un usuario con organización asociada",
        )
    return identity
