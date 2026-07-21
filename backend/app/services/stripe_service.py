import stripe
from app.core.config import settings


def init_stripe():
    stripe.api_key = settings.STRIPE_SECRET_KEY


def is_configured() -> bool:
    return bool(getattr(settings, "STRIPE_SECRET_KEY", None))


def create_customer(email: str, name: str = "", metadata: dict = None) -> dict:
    if not is_configured():
        raise RuntimeError("Stripe no configurado (STRIPE_SECRET_KEY ausente)")
    init_stripe()
    customer = stripe.Customer.create(
        email=email,
        name=name,
        metadata=metadata or {},
    )
    return {"id": customer.id}


def create_subscription(customer_id: str, price_id: str, metadata: dict = None) -> dict:
    if not is_configured():
        raise RuntimeError("Stripe no configurado (STRIPE_SECRET_KEY ausente)")
    init_stripe()
    subscription = stripe.Subscription.create(
        customer=customer_id,
        items=[{"price": price_id}],
        payment_behavior="default_incomplete",
        expand=["latest_invoice.payment_intent"],
        metadata=metadata or {},
    )
    pi = subscription.get("latest_invoice", {}).get("payment_intent", {})
    return {
        "subscription_id": subscription["id"],
        "status": subscription["status"],
        "client_secret": pi.get("client_secret") if isinstance(pi, dict) else None,
    }


def cancel_subscription(subscription_id: str) -> dict:
    if not is_configured():
        raise RuntimeError("Stripe no configurado (STRIPE_SECRET_KEY ausente)")
    init_stripe()
    sub = stripe.Subscription.delete(subscription_id)
    return {"id": sub["id"], "status": sub.get("status")}


def construct_webhook_event(payload: bytes, sig_header: str) -> dict:
    if not is_configured():
        raise RuntimeError("Stripe no configurado (STRIPE_SECRET_KEY ausente)")
    init_stripe()
    return stripe.Webhook.construct_event(
        payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
    )
