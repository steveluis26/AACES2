from __future__ import annotations
import logging
import os
from datetime import datetime
from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# Log file outside the repo so it never gets committed by accident.
CLIENT_ERROR_LOG = "/tmp/aaces_client_errors.log"

router = APIRouter()


class ClientErrorPayload(BaseModel):
    message: str = Field(default="")
    source: str = Field(default="")        # archivo/componente
    lineno: int | None = None
    colno: int | None = None
    stack: str | None = None
    href: str | None = None                 # location.href del navegador
    user_agent: str | None = None
    kind: str = Field(default="error")      # 'error' | 'unhandledrejection' | 'console'


@router.post("/client-error")
async def report_client_error(payload: ClientErrorPayload, request: Request):
    """Recibe errores de JS del navegador (baliza ErrorBeacon) y los escribe a disco.

    Es público a propósito: debe poder reportar aunque no haya sesión.
    No hace nada más (no toca BD, no afecta el flujo).
    """
    ip = request.client.host if request.client else "0.0.0.0"
    ua = payload.user_agent or request.headers.get("user-agent", "")
    ts = datetime.utcnow().isoformat(timespec="seconds") + "Z"
    line = (
        f"[{ts}] ip={ip} kind={payload.kind} href={payload.href} ua={ua} "
        f"msg={payload.message!r} src={payload.source}:{payload.lineno}:{payload.colno}\n"
    )
    if payload.stack:
        line += f"    stack: {payload.stack}\n"
    try:
        with open(CLIENT_ERROR_LOG, "a", encoding="utf-8") as f:
            f.write(line)
    except Exception as e:  # nunca debe romper la respuesta
        logger.warning("No se pudo escribir client-error log: %s", e)
    return {"ok": True}
