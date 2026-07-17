import asyncio
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel

from app.core.database import get_db
from app.api.v1.endpoints.auth import get_current_user_data
from app.services.stripe_service import create_payment_intent, construct_webhook_event

router = APIRouter()


class CreatePaymentSchema(BaseModel):
    curso_participante_id: str
    monto: float


@router.post("/create-payment-intent")
async def stripe_create_payment_intent(
    payload: CreatePaymentSchema,
    user_data: dict = Depends(get_current_user_data),
    db: AsyncSession = Depends(get_db),
):
    cid = user_data.get("sub")
    if not cid:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")
    await db.execute(text("SET LOCAL search_path TO aaces"))

    cp = await db.execute(
        text("""
            SELECT 1 FROM aaces.curso_participante cp
            JOIN aaces.cursos c ON c.id = cp.curso_id
            WHERE cp.id = :cp_id AND c.cliente_id = :cid
        """),
        {"cp_id": payload.curso_participante_id, "cid": cid},
    )
    if not cp.fetchone():
        raise HTTPException(status_code=404, detail="Participación del curso no encontrada")

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        lambda: create_payment_intent(
            amount=payload.monto,
            currency="mxn",
            description=f"Pago curso-participante {payload.curso_participante_id}",
            metadata={"curso_participante_id": payload.curso_participante_id, "cliente_id": cid},
        ),
    )
    return result


@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
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

    if event["type"] == "payment_intent.succeeded":
        pi = event["data"]["object"]
        cp_id = pi.get("metadata", {}).get("curso_participante_id")
        cid = pi.get("metadata", {}).get("cliente_id")
        amount = pi.get("amount", 0) / 100

        if cp_id and cid:
            await db.execute(text("SET LOCAL search_path TO aaces"))
            # Register the payment
            await db.execute(
                text("""
                    INSERT INTO aaces.pagos (cliente_id, curso_participante_id, tipo_pago, monto, moneda, metodo_pago, referencia_pago, fecha_pago, estado_pago, creado_por)
                    VALUES (:cid, :cp, 'participante', :monto, 'MXN', 'tarjeta', :ref, now(), 'completado', :cid)
                """),
                {"cid": cid, "cp": cp_id, "monto": amount, "ref": pi["id"]},
            )
            # Recalculate totals
            sums = await db.execute(
                text("SELECT COALESCE(SUM(monto),0) FROM aaces.pagos WHERE curso_participante_id = :cp AND estado_pago IN ('completado','pagado')"),
                {"cp": cp_id},
            )
            total_pagado = float(sums.scalar() or 0)
            await db.execute(
                text("UPDATE aaces.curso_participante SET estado_pago = CASE WHEN :total >= COALESCE(costo_asignado, 0) AND costo_asignado > 0 THEN 'pagado' WHEN :total > 0 THEN 'anticipo' ELSE 'pendiente' END, valor_pagado = :total WHERE id = :cp"),
                {"total": total_pagado, "cp": cp_id},
            )
            await db.commit()

    return {"status": "ok"}
