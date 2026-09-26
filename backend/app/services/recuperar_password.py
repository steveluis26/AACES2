"""Recuperar contraseña ("¿La olvidaste?").

- solicitar(): si el correo existe, crea un enlace de un solo uso y lo manda por
  correo. La respuesta al usuario es siempre la misma, exista o no la cuenta,
  para que nadie pueda averiguar qué correos están registrados.
- restablecer(): valida el enlace y guarda la nueva contraseña.

En la base solo se guarda el SHA-256 del token; el token en claro únicamente
viaja en el correo.
"""
import asyncio
import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.services.auth import auth_service
from app.services.email import email_service

logger = logging.getLogger(__name__)

MIN_LONGITUD = 8
MAX_POR_HORA_USUARIO = 3
MAX_POR_HORA_IP = 10


class EnlaceInvalido(Exception):
    """El enlace no existe, ya se usó o ya venció."""


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _minutos_vigencia() -> int:
    return max(10, int(settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES or 60))


def validar_password(password: str) -> Optional[str]:
    """Devuelve el motivo si la contraseña no sirve, o None si está bien."""
    if len(password) < MIN_LONGITUD:
        return f"La contraseña debe tener al menos {MIN_LONGITUD} caracteres"
    if len(password) > 100:
        return "La contraseña es demasiado larga"
    if not any(c.isalpha() for c in password) or not any(c.isdigit() for c in password):
        return "Usa letras y al menos un número"
    return None


def _correo(nombre: str, enlace: str, minutos: int) -> tuple[str, str]:
    texto = (
        f"Hola {nombre},\n\n"
        "Recibimos una solicitud para restablecer la contraseña de tu cuenta de AACES.\n"
        f"Abre este enlace para crear una nueva (vence en {minutos} minutos y solo sirve una vez):\n\n"
        f"{enlace}\n\n"
        "Si no fuiste tú, ignora este correo: tu contraseña no cambia.\n\n"
        "El equipo de AACES"
    )
    html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 520px;">
      <h2 style="color: #f97316; margin-bottom: 4px;">Restablece tu contraseña</h2>
      <p>Hola <strong>{nombre}</strong>,</p>
      <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta de AACES.</p>
      <p style="margin: 28px 0;">
        <a href="{enlace}" style="background: #f97316; color: #fff; padding: 12px 22px; border-radius: 999px; text-decoration: none; font-weight: bold;">Crear nueva contraseña</a>
      </p>
      <p style="font-size: 13px; color: #666;">El enlace vence en {minutos} minutos y solo sirve una vez.
      Si el botón no funciona, copia esta dirección en tu navegador:<br>
      <span style="word-break: break-all;">{enlace}</span></p>
      <p style="font-size: 13px; color: #666;">Si no fuiste tú, ignora este correo: tu contraseña no cambia.</p>
    </body>
    </html>
    """
    return texto, html


async def solicitar(db: AsyncSession, correo: str, ip: Optional[str]) -> Optional[dict]:
    """Crea el enlace si procede. Devuelve los datos del correo por enviar, o None.

    Nunca lanza por "correo no encontrado": quien llama responde lo mismo siempre.
    """
    correo = (correo or "").strip().lower()
    if not correo or "@" not in correo:
        return None

    if ip:
        por_ip = (await db.execute(text(
            "SELECT count(*) FROM aaces.restablecer_password "
            "WHERE ip = :ip AND fecha_creacion > NOW() - INTERVAL '1 hour'"
        ), {"ip": ip})).scalar() or 0
        if por_ip >= MAX_POR_HORA_IP:
            logger.warning("Recuperar contraseña: límite por IP alcanzado (%s)", ip)
            return None

    usuario = (await db.execute(text(
        "SELECT id, nombre, correo FROM aaces.usuarios "
        "WHERE lower(correo) = :correo AND COALESCE(activo, true) LIMIT 1"
    ), {"correo": correo})).mappings().first()
    if not usuario:
        return None

    recientes = (await db.execute(text(
        "SELECT count(*) FROM aaces.restablecer_password "
        "WHERE usuario_id = :u AND fecha_creacion > NOW() - INTERVAL '1 hour'"
    ), {"u": usuario["id"]})).scalar() or 0
    if recientes >= MAX_POR_HORA_USUARIO:
        logger.warning("Recuperar contraseña: límite por usuario alcanzado (%s)", usuario["id"])
        return None

    # Un enlace nuevo invalida los anteriores.
    await db.execute(text(
        "UPDATE aaces.restablecer_password SET usado_en = NOW() "
        "WHERE usuario_id = :u AND usado_en IS NULL"
    ), {"u": usuario["id"]})

    token = secrets.token_urlsafe(32)
    minutos = _minutos_vigencia()
    await db.execute(text(
        "INSERT INTO aaces.restablecer_password (usuario_id, token_hash, expira, ip) "
        "VALUES (:u, :h, :expira, :ip)"
    ), {
        "u": usuario["id"],
        "h": _hash(token),
        "expira": datetime.now(timezone.utc) + timedelta(minutes=minutos),
        "ip": (ip or "")[:64] or None,
    })
    await db.commit()

    enlace = f"{settings.FRONTEND_BASE_URL.rstrip('/')}/restablecer-password?token={token}"
    texto, html = _correo(usuario["nombre"] or "", enlace, minutos)
    return {"para": usuario["correo"], "texto": texto, "html": html}


async def enviar(datos: Optional[dict]) -> None:
    """Se corre en segundo plano, para que la respuesta tarde lo mismo exista o no la cuenta."""
    if not datos:
        return
    if not (settings.SMTP_USERNAME and settings.SMTP_PASSWORD):
        logger.critical("Recuperar contraseña: SMTP no configurado; no se pudo enviar el enlace a %s", datos["para"])
        return
    ok = await asyncio.to_thread(
        email_service.send_email, datos["para"], "AACES · Restablece tu contraseña", datos["texto"], datos["html"]
    )
    if not ok:
        logger.error("Recuperar contraseña: falló el envío a %s", datos["para"])


async def solicitar_y_enviar(correo: str, ip: Optional[str]) -> None:
    try:
        async with AsyncSessionLocal() as db:
            datos = await solicitar(db, correo, ip)
        await enviar(datos)
    except Exception:  # noqa: BLE001 - nunca debe tumbar la respuesta
        logger.exception("Recuperar contraseña: error al procesar la solicitud")


async def comprobar(db: AsyncSession, token: str) -> dict:
    """Valida el enlace sin usarlo (para que la página avise antes de escribir)."""
    fila = (await db.execute(text(
        "SELECT r.id, u.correo FROM aaces.restablecer_password r "
        "JOIN aaces.usuarios u ON u.id = r.usuario_id "
        "WHERE r.token_hash = :h AND r.usado_en IS NULL AND r.expira > NOW()"
    ), {"h": _hash(token or "")})).mappings().first()
    if not fila:
        raise EnlaceInvalido()
    return {"correo": fila["correo"]}


async def restablecer(db: AsyncSession, token: str, password: str) -> None:
    fila = (await db.execute(text(
        "SELECT id, usuario_id FROM aaces.restablecer_password "
        "WHERE token_hash = :h AND usado_en IS NULL AND expira > NOW() "
        "FOR UPDATE"
    ), {"h": _hash(token or "")})).mappings().first()
    if not fila:
        raise EnlaceInvalido()

    await db.execute(text(
        "UPDATE aaces.usuarios SET password_hash = :ph, must_change_password = false, "
        "intentos_fallidos = 0, bloqueado_hasta = NULL, fecha_actualizacion = NOW() "
        "WHERE id = :u"
    ), {"ph": auth_service.get_password_hash(password), "u": fila["usuario_id"]})
    await db.execute(text(
        "UPDATE aaces.restablecer_password SET usado_en = NOW() "
        "WHERE usuario_id = :u AND usado_en IS NULL"
    ), {"u": fila["usuario_id"]})
    await db.commit()
