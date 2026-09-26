import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.identity import Identity, get_current_identity, require_org_id
from app.services import mercadopago as mp
from app.services import suscripciones as svc

logger = logging.getLogger(__name__)
router = APIRouter()


class PagoIn(BaseModel):
    plan_codigo: str
    periodo: str = "mensual"  # mensual | anual
    correo: Optional[str] = None  # correo de la cuenta de Mercado Pago


class PaqueteIn(BaseModel):
    correo: Optional[str] = None


@router.get("/planes")
async def listar_planes(db: AsyncSession = Depends(get_db)):
    return await svc.planes(db)


@router.get("/mia")
async def mi_suscripcion(identity: Identity = Depends(get_current_identity), db: AsyncSession = Depends(get_db)):
    return await svc.actual(db, await require_org_id(db, identity))


@router.post("/pagar")
async def pagar(body: PagoIn, identity: Identity = Depends(get_current_identity), db: AsyncSession = Depends(get_db)):
    """Inicia el pago en Mercado Pago y devuelve la liga a donde mandar al cliente."""
    org_id = await require_org_id(db, identity)
    return await svc.iniciar_pago(db, org_id, body.plan_codigo, body.periodo, body.correo or identity.email)


@router.post("/paquete")
async def paquete(body: PaqueteIn, identity: Identity = Depends(get_current_identity), db: AsyncSession = Depends(get_db)):
    org_id = await require_org_id(db, identity)
    return await svc.comprar_paquete(db, org_id, body.correo or identity.email)


@router.post("/cancelar")
async def cancelar(identity: Identity = Depends(get_current_identity), db: AsyncSession = Depends(get_db)):
    return await svc.cancelar(db, await require_org_id(db, identity))


@router.post("/webhook")
async def webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Avisos de Mercado Pago. Configura esta URL en Mercado Pago → Tus integraciones →
    Webhooks, con los eventos Pagos y Planes y suscripciones."""
    q = dict(request.query_params)
    try:
        body = await request.json()
    except Exception:
        body = {}
    tipo = body.get("type") or q.get("type") or q.get("topic") or ""
    recurso = str((body.get("data") or {}).get("id") or q.get("data.id") or q.get("id") or "")
    if not tipo or not recurso:
        return {"ok": True}
    if not mp.firma_valida(request.headers.get("x-signature", ""), request.headers.get("x-request-id", ""), recurso):
        logger.warning("Webhook de Mercado Pago con firma inválida (%s %s)", tipo, recurso)
        raise HTTPException(401, "Firma inválida")
    try:
        resultado = await svc.procesar_aviso(db, tipo, recurso)
    except mp.MercadoPagoError:
        # Error temporal consultando la API: respondemos 500 para que Mercado Pago reintente
        raise HTTPException(500, "No se pudo consultar Mercado Pago")
    logger.info("Webhook Mercado Pago %s %s -> %s", tipo, recurso, resultado)
    return {"ok": True, "resultado": resultado}
