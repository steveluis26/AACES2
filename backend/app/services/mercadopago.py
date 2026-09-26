"""Cliente mínimo de la API de Mercado Pago (suscripciones y pagos únicos).

- Mensual: "preapproval" (suscripción con cobro automático a tarjeta o saldo).
- Anual y paquetes extra: "preference" de Checkout Pro (pago único con tarjeta,
  OXXO, SPEI o saldo).

Nunca confiamos en el cuerpo de un webhook: siempre volvemos a consultar el
recurso en la API con nuestro token antes de activar nada.
"""
import hashlib
import hmac
import logging
from typing import Any, Dict, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

API = "https://api.mercadopago.com"


class MercadoPagoError(Exception):
    pass


def configurado() -> bool:
    return bool(settings.MERCADOPAGO_ACCESS_TOKEN)


async def _req(metodo: str, ruta: str, json: Optional[dict] = None) -> Dict[str, Any]:
    if not configurado():
        raise MercadoPagoError("Mercado Pago no está configurado en el servidor (MERCADOPAGO_ACCESS_TOKEN).")
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.request(
            metodo, f"{API}{ruta}", json=json,
            headers={"Authorization": f"Bearer {settings.MERCADOPAGO_ACCESS_TOKEN}"},
        )
    if r.status_code >= 400:
        logger.error("Mercado Pago %s %s -> %s %s", metodo, ruta, r.status_code, r.text[:500])
        raise MercadoPagoError(f"Mercado Pago respondió {r.status_code}")
    return r.json()


def _urls() -> Dict[str, str]:
    front = settings.FRONTEND_BASE_URL.rstrip("/")
    return {
        "retorno": f"{front}/cliente/pagos",
        "webhook": f"{settings.PUBLIC_API_BASE_URL.rstrip('/')}/suscripciones/webhook",
    }


async def crear_suscripcion_mensual(*, titulo: str, monto: float, correo: str, referencia: str) -> Dict[str, Any]:
    """Devuelve {id, init_point}. El cliente autoriza el cobro en init_point."""
    u = _urls()
    return await _req("POST", "/preapproval", {
        "reason": titulo,
        "external_reference": referencia,
        "payer_email": correo,
        "auto_recurring": {
            "frequency": 1,
            "frequency_type": "months",
            "transaction_amount": round(float(monto), 2),
            "currency_id": "MXN",
        },
        "back_url": f"{u['retorno']}?pago=mensual",
        "status": "pending",
    })


async def crear_pago_unico(*, titulo: str, monto: float, correo: str, referencia: str, retorno: str) -> Dict[str, Any]:
    """Checkout Pro: tarjeta, OXXO, SPEI o saldo. Devuelve {id, init_point}."""
    u = _urls()
    return await _req("POST", "/checkout/preferences", {
        "items": [{"title": titulo, "quantity": 1, "unit_price": round(float(monto), 2), "currency_id": "MXN"}],
        "payer": {"email": correo},
        "external_reference": referencia,
        # Sin meses sin intereses: Mercado Pago cobra comisión extra por ellos
        "payment_methods": {"installments": 1},
        "back_urls": {
            "success": f"{u['retorno']}?pago={retorno}&estado=aprobado",
            "pending": f"{u['retorno']}?pago={retorno}&estado=pendiente",
            "failure": f"{u['retorno']}?pago={retorno}&estado=rechazado",
        },
        "auto_return": "approved",
        "notification_url": u["webhook"],
        "statement_descriptor": "AACES",
    })


async def obtener_suscripcion(preapproval_id: str) -> Dict[str, Any]:
    return await _req("GET", f"/preapproval/{preapproval_id}")


async def cancelar_suscripcion(preapproval_id: str) -> Dict[str, Any]:
    return await _req("PUT", f"/preapproval/{preapproval_id}", {"status": "cancelled"})


async def obtener_pago(pago_id: str) -> Dict[str, Any]:
    return await _req("GET", f"/v1/payments/{pago_id}")


async def obtener_cobro_suscripcion(authorized_payment_id: str) -> Dict[str, Any]:
    return await _req("GET", f"/authorized_payments/{authorized_payment_id}")


def firma_valida(x_signature: str, x_request_id: str, data_id: str) -> bool:
    """Valida la cabecera x-signature (si configuraste la clave secreta de webhooks).
    Sin clave configurada se acepta: igual volvemos a consultar todo en la API."""
    secreto = settings.MERCADOPAGO_WEBHOOK_SECRET
    if not secreto:
        return True
    partes = dict(p.strip().split("=", 1) for p in (x_signature or "").split(",") if "=" in p)
    ts, v1 = partes.get("ts"), partes.get("v1")
    if not ts or not v1:
        return False
    manifest = f"id:{str(data_id).lower()};request-id:{x_request_id};ts:{ts};"
    esperado = hmac.new(secreto.encode(), manifest.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(esperado, v1)
