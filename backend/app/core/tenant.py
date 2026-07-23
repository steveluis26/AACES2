"""
Tenant — ÚNICA fuente de verdad del tenant para filtrado de datos.

Regla de arquitectura (ARCHITECTURE_RULES.md / CONTRACTS.md / RC-1):
  La resolución del tenant ocurre EXACTAMENTE UNA VEZ, en
  `get_current_user_data()` (auth.py), que normaliza SIEMPRE
  `organizacion_id` en el payload del JWT (desde `org_id` o resolviendo
  desde BD para tokens viejos).

  Ningún servicio ni endpoint debe "resolver" el tenant por su cuenta
  (no `sub`, no JOIN a clientes, no subconsulta). Todos consumen el
  `organizacion_id` ya resuelto.

Uso:
    from app.core.tenant import organization_id
    org_id = organization_id(user_data)   # str o None

Si devuelve None, el llamador debe rechazar con 401 (usuario sin tenant).
"""
from typing import Optional


def organization_id(user_data: dict) -> Optional[str]:
    """Devuelve el organization_id ya normalizado por get_current_user_data.

    NO hace ninguna resolución propia: confía en que auth.py ya garantió
    `organizacion_id` en el payload. Si no está, es un token mal formado.
    """
    if not user_data:
        return None
    return user_data.get("organizacion_id") or user_data.get("org_id")
