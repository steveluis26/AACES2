import stripe
from app.core.config import settings

stripe.api_key = settings.STRIPE_SECRET_KEY


def create_payment_intent(
    amount: float,
    currency: str = "mxn",
    description: str = "",
    metadata: dict = None,
) -> dict:
    intent = stripe.PaymentIntent.create(
        amount=int(round(amount * 100)),
        currency=currency,
        description=description,
        metadata=metadata or {},
    )
    return {
        "client_secret": intent.client_secret,
        "payment_intent_id": intent.id,
        "amount": amount,
        "currency": currency,
    }


def construct_webhook_event(payload: bytes, sig_header: str) -> stripe.Event:
    return stripe.Webhook.construct_event(
        payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
    )
