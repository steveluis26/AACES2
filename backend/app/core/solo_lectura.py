"""Modo solo lectura cuando la suscripción de la organización no está activa.

Regla: lo que el cliente ya pagó se respeta. Sin suscripción activa puede entrar,
consultar todo, reimprimir los DC-3 que ya tienen folio, pagar/renovar y cambiar
su contraseña; no puede crear ni editar (cursos, participantes, plantillas...) ni
emitir constancias nuevas. La verificación pública de sus DC-3 no cambia.

(Suspender la organización desde el admin es otra cosa: bloquea el acceso.)
"""
import re
from typing import Optional

from fastapi import Request
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.core.database import AsyncSessionLocal
from app.services.auth import auth_service

ESCRITURA = {"POST", "PUT", "PATCH", "DELETE"}

# Escrituras permitidas sin suscripción activa (sobre /api/v1)
PERMITIDAS = [re.compile(p) for p in (
    r"^/auth/",                              # login, refresh, logout, perfil
    r"^/suscripciones/",                     # pagar / renovar / comprar paquete (Mercado Pago)
    r"^/clientes/me/password$",              # cambiar contraseña
    r"^/organizaciones/perfil$",             # datos de facturación
    r"^/notificaciones/",                    # marcar avisos como leídos
    r"^/plantillas-pdf/[^/]+/(generar|vista-previa)$",  # reimprimir (el límite frena folios nuevos)
    r"^/templates/preview$",
    r"^/(public|verificar|verificaciones|validaciones)(/|$)",
    r"^/contacto$",
)]

MENSAJE = ("Tu suscripción no está activa: estás en modo solo lectura. Puedes consultar y "
           "reimprimir tus DC-3, pero no crear ni editar. Renueva tu plan para seguir trabajando.")


def _permitida(ruta: str) -> bool:
    return any(p.search(ruta) for p in PERMITIDAS)


async def _org_activa(user_id: str) -> Optional[bool]:
    async with AsyncSessionLocal() as s:
        org = (await s.execute(
            text("SELECT organizacion_id FROM aaces.usuarios WHERE id = CAST(:u AS uuid)"), {"u": user_id}
        )).scalar()
        if not org:
            return None
        return bool((await s.execute(
            text("SELECT activa FROM aaces.cupo_constancias(CAST(:o AS uuid))"), {"o": str(org)}
        )).scalar())


async def middleware_solo_lectura(request: Request, call_next):
    ruta = request.url.path
    if request.method in ESCRITURA and ruta.startswith("/api/v1/") and not _permitida(ruta[len("/api/v1"):]):
        auth = request.headers.get("authorization") or ""
        if auth.lower().startswith("bearer "):
            payload = auth_service.decode_token(auth[7:].strip())
            # Solo aplica a usuarios de organización; la plataforma (admin) no se limita
            if payload and payload.get("source") == "usuario" and payload.get("sub"):
                try:
                    activa = await _org_activa(str(payload["sub"]))
                except Exception:
                    activa = None  # ante un error no bloqueamos: decide el endpoint
                if activa is False:
                    return JSONResponse(status_code=402, content={"detail": MENSAJE, "solo_lectura": True})
    return await call_next(request)
