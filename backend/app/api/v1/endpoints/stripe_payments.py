import asyncio
import uuid
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel

from app.core.database import get_db
from app.api.v1.endpoints.auth import get_current_user_data
from app.services.stripe_service import (
    is_configured,
    create_customer,
    create_subscription,
    cancel_subscription,
    construct_webhook_event,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class CrearSuscripcionSchema(BaseModel):
    plan_codigo: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
async def _org_id_de_user(db, user_data: dict):
    org_id = user_data.get("org_id")
    if not org_id:
        # Si el token no trae org, la resolvemos desde clientes->organizacion
        cid = user_data.get("sub")
        res = await db.execute(
            text("SELECT organizacion_id FROM aaces.clientes WHERE id = :cid LIMIT 1"),
            {"cid": cid},
        )
        row = res.fetchone()
        org_id = str(row[0]) if row and row[0] else None
    return org_id


async def _get_or_create_stripe_customer(db, org_id: str, email: str, nombre: str):
    res = await db.execute(
        text("SELECT stripe_customer_id FROM aaces.organizaciones WHERE id = :id LIMIT 1"),
        {"id": org_id},
    )
    row = res.fetchone()
    existing = row[0] if row else None
    if existing:
        return existing
    customer = create_customer(email=email, name=nombre, metadata={"organizacion_id": org_id})
    cid = customer["id"]
    await db.execute(
        text("UPDATE aaces.organizaciones SET stripe_customer_id = :c WHERE id = :id"),
        {"c": cid, "id": org_id},
    )
    await db.commit()
    return cid


# ---------------------------------------------------------------------------
# Planes (públicos/activos)
# ---------------------------------------------------------------------------
@router.get("/planes")
async def listar_planes(db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        text(
            "SELECT id, codigo, nombre, descripcion, precio_mensual, precio_anual, "
            "cursos_max, usuarios_max, constancias_max, incluye_marketplace, incluye_api, "
            "incluye_white_label, incluye_soporte_prioritario "
            "FROM aaces.planes WHERE activo = TRUE ORDER BY precio_mensual"
        )
    )
    planes = []
    for r in res.fetchall():
        planes.append(
            {
                "id": str(r[0]),
                "codigo": r[1],
                "nombre": r[2],
                "descripcion": r[3],
                "precio_mensual": float(r[4] or 0),
                "precio_anual": float(r[5] or 0),
                "cursos_max": r[6],
                "usuarios_max": r[7],
                "constancias_max": r[8],
                "incluye_marketplace": r[9],
                "incluye_api": r[10],
                "incluye_white_label": r[11],
                "incluye_soporte_prioritario": r[12],
            }
        )
    return planes


# ---------------------------------------------------------------------------
# Suscripción actual de la organización del usuario
# ---------------------------------------------------------------------------
@router.get("/suscripcion/mia")
async def mi_suscripcion(
    user_data: dict = Depends(get_current_user_data),
    db: AsyncSession = Depends(get_db),
):
    org_id = await _org_id_de_user(db, user_data)
    if not org_id:
        raise HTTPException(status_code=400, detail="Sin organización asociada")
    await db.execute(text("SET LOCAL search_path TO aaces"))
    res = await db.execute(
        text(
            """
            SELECT s.id, s.plan_id, p.nombre, p.codigo, s.estatus, s.fecha_inicio, s.fecha_fin,
                   s.metodo_pago, s.referencia_pago
            FROM aaces.suscripciones s
            JOIN aaces.planes p ON p.id = s.plan_id
            WHERE s.organizacion_id = :org
            ORDER BY s.fecha_creacion DESC LIMIT 1
            """
        ),
        {"org": org_id},
    )
    row = res.fetchone()
    if not row:
        return None
    return {
        "id": str(row[0]),
        "plan_id": str(row[1]),
        "plan_nombre": row[2],
        "plan_codigo": row[3],
        "estatus": row[4],
        "fecha_inicio": row[5].isoformat() if row[5] else None,
        "fecha_fin": row[6].isoformat() if row[6] else None,
        "metodo_pago": row[7],
        "referencia_pago": row[8],
    }


# ---------------------------------------------------------------------------
# Crear / iniciar suscripción (cliente -> AACES)
# ---------------------------------------------------------------------------
@router.post("/suscripcion")
async def crear_suscripcion(
    payload: CrearSuscripcionSchema,
    user_data: dict = Depends(get_current_user_data),
    db: AsyncSession = Depends(get_db),
):
    org_id = await _org_id_de_user(db, user_data)
    if not org_id:
        raise HTTPException(status_code=400, detail="Sin organización asociada")

    await db.execute(text("SET LOCAL search_path TO aaces"))

    # Plan solicitado
    plan_res = await db.execute(
        text(
            "SELECT id, codigo, nombre, precio_mensual, stripe_price_id "
            "FROM aaces.planes WHERE codigo = :c AND activo = TRUE LIMIT 1"
        ),
        {"c": payload.plan_codigo},
    )
    plan_row = plan_res.fetchone()
    if not plan_row:
        raise HTTPException(status_code=404, detail="Plan no encontrado")

    plan_id = str(plan_row[0])
    plan_codigo = plan_row[1]
    plan_nombre = plan_row[2]
    precio = float(plan_row[3] or 0)
    stripe_price_id = plan_row[4]

    hoy = date.today()
    fin = hoy + timedelta(days=30)

    # --- Plan gratuito ($0): se activa directo, sin cobro ---
    if precio <= 0:
        sub_id = str(uuid.uuid4())
        await db.execute(
            text(
                """
                INSERT INTO aaces.suscripciones
                    (id, organizacion_id, plan_id, estatus, fecha_inicio, fecha_fin, metodo_pago, referencia_pago)
                VALUES (:id, :org, :plan, 'activa', :ini, :fin, 'gratuito', 'demo')
                """
            ),
            {"id": sub_id, "org": org_id, "plan": plan_id, "ini": hoy, "fin": fin},
        )
        await db.commit()
        return {
            "demo": True,
            "suscripcion_id": sub_id,
            "estatus": "activa",
            "plan": plan_nombre,
            "client_secret": None,
            "mensaje": "Plan de prueba activado sin costo.",
        }

    # --- Plan de pago ---
    if not is_configured():
        # MODO DEMO: registramos la suscripción como pendiente y devolvemos un
        # client_secret simulado. No hay cobro real.
        sub_id = str(uuid.uuid4())
        await db.execute(
            text(
                """
                INSERT INTO aaces.suscripciones
                    (id, organizacion_id, plan_id, estatus, fecha_inicio, fecha_fin, metodo_pago, referencia_pago)
                VALUES (:id, :org, :plan, 'pendiente', :ini, :fin, 'stripe', 'demo')
                """
            ),
            {"id": sub_id, "org": org_id, "plan": plan_id, "ini": hoy, "fin": fin},
        )
        await db.commit()
        return {
            "demo": True,
            "suscripcion_id": sub_id,
            "estatus": "pendiente",
            "plan": plan_nombre,
            "client_secret": f"demo_secret_{sub_id}",
            "mensaje": "Modo demo: configura STRIPE_SECRET_KEY para cobro real. "
                       "La suscripción queda pendiente hasta confirmar el pago.",
        }

    # --- MODO REAL: Stripe Billing ---
    if not stripe_price_id:
        raise HTTPException(
            status_code=400,
            detail="Plan sin stripe_price_id configurado. Define el Price de Stripe en la tabla planes.",
        )
    # Email de contacto de la org
    org_res = await db.execute(
        text("SELECT email_contacto, razon_social, nombre_comercial FROM aaces.organizaciones WHERE id = :id"),
        {"id": org_id},
    )
    org_row = org_res.fetchone()
    email = (org_row[0] if org_row and org_row[0] else "cliente@aaces.mx")
    nombre = (org_row[2] or org_row[1] or "Cliente")

    customer_id = await _get_or_create_stripe_customer(db, org_id, email, nombre)
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        lambda: create_subscription(
            customer_id=customer_id,
            price_id=stripe_price_id,
            metadata={"organizacion_id": org_id, "plan_codigo": plan_codigo},
        ),
    )
    sub_id = str(uuid.uuid4())
    await db.execute(
        text(
            """
            INSERT INTO aaces.suscripciones
                (id, organizacion_id, plan_id, estatus, fecha_inicio, fecha_fin, metodo_pago, referencia_pago)
            VALUES (:id, :org, :plan, 'pendiente', :ini, :fin, 'stripe', :ref)
            """
        ),
        {"id": sub_id, "org": org_id, "plan": plan_id, "ini": hoy, "fin": fin, "ref": result["subscription_id"]},
    )
    await db.commit()
    return {
        "demo": False,
        "suscripcion_id": sub_id,
        "estatus": "pendiente",
        "plan": plan_nombre,
        "client_secret": result.get("client_secret"),
        "stripe_subscription_id": result["subscription_id"],
        "mensaje": "Confirma el pago en la pasarela para activar tu suscripción.",
    }


# ---------------------------------------------------------------------------
# Cancelar suscripción
# ---------------------------------------------------------------------------
@router.put("/suscripcion/{suscripcion_id}/cancelar")
async def cancelar_suscripcion(
    suscripcion_id: str,
    user_data: dict = Depends(get_current_user_data),
    db: AsyncSession = Depends(get_db),
):
    org_id = await _org_id_de_user(db, user_data)
    await db.execute(text("SET LOCAL search_path TO aaces"))
    res = await db.execute(
        text("SELECT id, referencia_pago, estatus FROM aaces.suscripciones WHERE id = :id AND organizacion_id = :org LIMIT 1"),
        {"id": suscripcion_id, "org": org_id},
    )
    row = res.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Suscripción no encontrada")
    ref = row[1]
    estatus_actual = row[2]

    if ref and ref not in ("demo",) and is_configured():
        try:
            await asyncio.get_event_loop().run_in_executor(None, lambda: cancel_subscription(ref))
        except Exception:
            pass  # no bloquea la cancelación local

    await db.execute(
        text("UPDATE aaces.suscripciones SET estatus = 'cancelada', fecha_actualizacion = now() WHERE id = :id"),
        {"id": suscripcion_id},
    )
    await db.commit()
    return {"estatus": "cancelada"}


# ---------------------------------------------------------------------------
# Webhook de Stripe (producción)
# ---------------------------------------------------------------------------
@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    if not is_configured():
        raise HTTPException(status_code=400, detail="Stripe no configurado en este entorno")
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    if not sig_header:
        raise HTTPException(status_code=400, detail="Firma de webhook faltante")

    try:
        event = await asyncio.get_event_loop().run_in_executor(
            None, lambda: construct_webhook_event(payload, sig_header)
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Firma inválida")

    await db.execute(text("SET LOCAL search_path TO aaces"))

    if event["type"] in ("invoice.paid", "customer.subscription.updated", "checkout.session.completed"):
        obj = event["data"]["object"]
        subscription_id = obj.get("subscription") or obj.get("id")
        if subscription_id:
            await db.execute(
                text(
                    "UPDATE aaces.suscripciones SET estatus = 'activa', referencia_pago = :ref, "
                    "fecha_actualizacion = now() WHERE referencia_pago = :ref"
                ),
                {"ref": subscription_id},
            )
            await db.commit()

    return {"status": "ok"}
