"""Cifrado de datos personales en la base (RFC de organizaciones, CURP de
participantes e instructores).

- Valor guardado: "enc1:" + token Fernet (AES-128-CBC + HMAC-SHA256). Sin la llave
  no se puede leer; un respaldo o una fuga de la base no expone RFC ni CURP.
- Índice ciego: HMAC-SHA256 del valor normalizado (columna *_hash). Permite buscar
  por igualdad y exigir que no se repita sin descifrar nada.

La llave se deriva de la variable de entorno ENCRYPTION_KEY. IMPORTANTE:
- Si ENCRYPTION_KEY no está definida NO se cifra (se guarda como antes) y se avisa
  en el log: la configuración generaría una llave aleatoria distinta en cada
  arranque y lo cifrado sería irrecuperable.
- Una vez cifrados los datos, ENCRYPTION_KEY no debe cambiar ni perderse.
- Los valores viejos sin prefijo se leen tal cual y se cifran en el arranque
  (migrar_datos) en cuanto hay llave.
"""
import base64
import hashlib
import hmac
import logging
import os
import re
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger(__name__)

PREFIJO = "enc1:"


def _leer_clave() -> str:
    # En producción viene del entorno; en desarrollo, del archivo .env (la configuración
    # lo lee sin exportarlo). Nunca se usa la llave aleatoria de respaldo de config.py.
    v = os.getenv("ENCRYPTION_KEY")
    if not v:
        try:
            from dotenv import dotenv_values
            v = dotenv_values(".env").get("ENCRYPTION_KEY")
        except Exception:
            v = None
    return (v or "").strip()


_CLAVE = _leer_clave()
ACTIVO = len(_CLAVE) >= 32

if ACTIVO:
    _fernet = Fernet(base64.urlsafe_b64encode(hashlib.sha256(b"aaces:datos:" + _CLAVE.encode()).digest()))
    _llave_indice = hashlib.sha256(b"aaces:indice:" + _CLAVE.encode()).digest()
else:
    _fernet = None
    _llave_indice = b""
    logger.critical(
        "ENCRYPTION_KEY no está definida (o es muy corta): RFC y CURP se guardan SIN cifrar. "
        "Defínela en el entorno (mínimo 32 caracteres) y no la cambies después."
    )


def normalizar(valor: Optional[str]) -> str:
    return re.sub(r"[\s-]", "", (valor or "")).upper()


def cifrar(valor: Optional[str]) -> Optional[str]:
    """Cifra un RFC/CURP ya normalizado. Vacío -> None."""
    v = normalizar(valor)
    if not v:
        return None
    if not ACTIVO:
        return v
    return PREFIJO + _fernet.encrypt(v.encode()).decode()


def descifrar(valor: Optional[str]) -> Optional[str]:
    """Devuelve el texto legible. Los valores viejos sin cifrar se devuelven tal cual."""
    if not valor:
        return None
    if not valor.startswith(PREFIJO):
        return valor
    if not ACTIVO:
        logger.error("Hay datos cifrados pero ENCRYPTION_KEY no está definida")
        return None
    try:
        return _fernet.decrypt(valor[len(PREFIJO):].encode()).decode()
    except InvalidToken:
        logger.error("No se pudo descifrar un dato: ¿cambió ENCRYPTION_KEY?")
        return None


def indice(valor: Optional[str]) -> Optional[str]:
    """Índice ciego para buscar/comparar sin descifrar. Sin llave se usa el valor normalizado
    con SHA-256 (se recalcula con la llave al activar el cifrado)."""
    v = normalizar(valor)
    if not v:
        return None
    if ACTIVO:
        return hmac.new(_llave_indice, v.encode(), hashlib.sha256).hexdigest()
    return hashlib.sha256(v.encode()).hexdigest()


# ---------------------------------------------------------------------------
# Migración al arrancar
# ---------------------------------------------------------------------------

_COLUMNAS = [
    ("organizaciones", "rfc", "rfc_hash"),
    ("participantes", "curp", "curp_hash"),
    ("instructores", "curp", "curp_hash"),
    ("stps_consultas", "rfc", None),
]


async def migrar_datos(conn) -> dict:
    """Cifra los valores que aún están en claro y recalcula los índices.
    Idempotente: solo toca filas sin prefijo o sin índice."""
    from sqlalchemy import text
    resumen = {}
    for tabla, col, col_hash in _COLUMNAS:
        n = 0
        filtro = f"({col} IS NOT NULL AND {col} NOT LIKE 'enc1:%')"
        if col_hash:
            filtro += f" OR ({col} IS NOT NULL AND {col_hash} IS NULL)"
        if not ACTIVO:
            # Sin llave solo se completan los índices (para que la validación de duplicados funcione)
            if not col_hash:
                continue
            filtro = f"{col} IS NOT NULL AND {col_hash} IS NULL"
        filas = (await conn.execute(text(f"SELECT id, {col} FROM aaces.{tabla} WHERE {filtro}"))).fetchall()
        for fid, valor in filas:
            claro = descifrar(valor)
            if claro is None:
                continue
            sets = {col: cifrar(claro)}
            if col_hash:
                sets[col_hash] = indice(claro)
            asignar = ", ".join(f"{k} = :{k}" for k in sets)
            await conn.execute(text(f"UPDATE aaces.{tabla} SET {asignar} WHERE id = :id"), {**sets, "id": fid})
            n += 1
        resumen[f"{tabla}.{col}"] = n
    return resumen
