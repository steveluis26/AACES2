"""Suscripciones de las agencias a AACES, cobradas con Mercado Pago.

Mensual: suscripción de Mercado Pago (cobro automático). Cada cobro aprobado
extiende `pagado_hasta` un mes; `fecha_fin` = pagado_hasta + días de gracia, para
que un cobro fallido no corte el servicio de inmediato. Si Mercado Pago no logra
cobrar y pasa la gracia, la cuenta queda sola en solo lectura (y sale del
marketplace) porque su suscripción deja de estar vigente.

Anual y paquetes extra: pago único (tarjeta, OXXO, SPEI). El anual extiende 12 meses.

Referencias externas: AACES:SUS:{suscripcion_id} y AACES:PAQ:{org_id}:{uuid}.
"""
import logging
import uuid
from datetime import date, datetime
from typing import Any, Dict, Optional
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.services import mercadopago as mp

logger = logging.getLogger(__name__)

VIGENTE = """
    (s.estatus = 'activa' AND (s.fecha_fin IS NULL OR s.fecha_fin >= :hoy)
     OR s.estatus = 'cancelada' AND s.fecha_fin IS NOT NULL AND s.fecha_fin >= :hoy)
"""

BENEFICIOS = {
    "trial": ["50 constancias en total", "Plantillas DC-3 con tu formato", "QR verificable"],
    "profesional": ["500 constancias al mes", "Plantillas DC-3 con tu formato", "QR verificable",
                    "Aparece en el Marketplace", "Paquetes extra cuando los necesites"],
    "empresa": ["2,000 constancias al mes", "Todo lo del plan Profesional", "Soporte prioritario",
                "API de validación", "Paquetes extra cuando los necesites"],
}


def hoy() -> date:
    return datetime.now(ZoneInfo("America/Mexico_City")).date()


async def _sumar_meses(db: AsyncSession, base: date, meses: int) -> date:
    return (await db.execute(
        text("SELECT (CAST(:b AS date) + make_interval(months => CAST(:m AS integer)))::date"),
        {"b": base, "m": meses},
    )).scalar()


# ---------------------------------------------------------------------------
# Consultas
# ---------------------------------------------------------------------------

async def planes(db: AsyncSession) -> list:
    rows = (await db.execute(text("""
        SELECT codigo, nombre, descripcion, precio_mensual, precio_anual, constancias_max, incluye_marketplace
        FROM aaces.planes WHERE activo = true ORDER BY precio_mensual
    """))).fetchall()
    return [{
        "codigo": r[0], "nombre": r[1], "descripcion": r[2],
        "precio_mensual": float(r[3] or 0), "precio_anual": float(r[4] or 0),
        "constancias": None if r[5] is None or r[5] >= 999999 else int(r[5]),
        "marketplace": bool(r[6]),
        "beneficios": BENEFICIOS.get(r[0], []),
    } for r in rows]


async def actual(db: AsyncSession, org_id: str) -> Optional[Dict[str, Any]]:
    r = (await db.execute(text(f"""
        SELECT s.id, p.codigo, p.nombre, s.estatus, s.periodo, s.fecha_inicio, s.fecha_fin, s.pagado_hasta,
               s.metodo_pago, p.precio_mensual, p.precio_anual
        FROM aaces.suscripciones s JOIN aaces.planes p ON p.id = s.plan_id
        WHERE s.organizacion_id = CAST(:org AS uuid) AND {VIGENTE}
        ORDER BY s.fecha_inicio DESC NULLS LAST, s.fecha_creacion DESC
        LIMIT 1
    """), {"org": org_id, "hoy": hoy()})).fetchone()
    pendiente = (await db.execute(text("""
        SELECT s.id, p.nombre, s.periodo, s.fecha_creacion FROM aaces.suscripciones s JOIN aaces.planes p ON p.id = s.plan_id
        WHERE s.organizacion_id = CAST(:org AS uuid) AND s.estatus = 'pendiente'
          AND s.fecha_creacion > now() - interval '2 days'
        ORDER BY s.fecha_creacion DESC LIMIT 1
    """), {"org": org_id})).fetchone()
    base = None
    if r:
        base = {
            "id": str(r[0]), "plan_codigo": r[1], "plan_nombre": r[2], "estatus": r[3],
            "periodo": r[4] or ("prueba" if r[1] == "trial" else None),
            "fecha_inicio": r[5].isoformat() if r[5] else None,
            "vence": r[6].isoformat() if r[6] else None,
            "pagado_hasta": r[7].isoformat() if r[7] else None,
            "renovacion_automatica": r[4] == "mensual" and r[3] == "activa",
            "precio": float((r[10] if r[4] == "anual" else r[9]) or 0),
        }
    return {
        "actual": base,
        "pendiente": {"id": str(pendiente[0]), "plan_nombre": pendiente[1], "periodo": pendiente[2]} if pendiente else None,
        "pagos_configurados": mp.configurado(),
        "paquete": {"cantidad": settings.PAQUETE_CANTIDAD, "precio": settings.PAQUETE_PRECIO},
    }


async def _correo_org(db: AsyncSession, org_id: str, respaldo: Optional[str]) -> str:
    c = (await db.execute(text("SELECT email_contacto FROM aaces.organizaciones WHERE id = CAST(:o AS uuid)"), {"o": org_id})).scalar()
    return (respaldo or c or "").strip()


# ---------------------------------------------------------------------------
# Cobros
# ---------------------------------------------------------------------------

async def iniciar_pago(db: AsyncSession, org_id: str, plan_codigo: str, periodo: str, correo: Optional[str]) -> Dict[str, Any]:
    if periodo not in ("mensual", "anual"):
        raise HTTPException(400, "Periodo inválido")
    plan = (await db.execute(text("""
        SELECT id, nombre, precio_mensual, precio_anual FROM aaces.planes
        WHERE codigo = :c AND activo = true AND COALESCE(precio_mensual, 0) > 0
    """), {"c": plan_codigo})).fetchone()
    if not plan:
        raise HTTPException(400, "Plan no disponible")
    if not mp.configurado():
        raise HTTPException(503, "Los pagos en línea aún no están activos. Escríbenos y activamos tu plan manualmente.")
    correo = await _correo_org(db, org_id, correo)
    if not correo:
        raise HTTPException(400, "Escribe el correo de tu cuenta de Mercado Pago")

    monto = float(plan[3] if periodo == "anual" else plan[2])
    sus_id = str(uuid.uuid4())
    ref = f"AACES:SUS:{sus_id}"
    titulo = f"AACES plan {plan[1]} ({'anual' if periodo == 'anual' else 'mensual'})"
    try:
        if periodo == "mensual":
            r = await mp.crear_suscripcion_mensual(titulo=titulo, monto=monto, correo=correo, referencia=ref)
        else:
            r = await mp.crear_pago_unico(titulo=titulo, monto=monto, correo=correo, referencia=ref, retorno="anual")
    except mp.MercadoPagoError as e:
        raise HTTPException(502, f"No pudimos iniciar el pago: {e}")

    # Intentos anteriores sin pagar quedan como abandonados
    await db.execute(text("UPDATE aaces.suscripciones SET estatus = 'abandonada' WHERE organizacion_id = CAST(:o AS uuid) AND estatus = 'pendiente'"), {"o": org_id})
    await db.execute(text("""
        INSERT INTO aaces.suscripciones (id, organizacion_id, plan_id, estatus, periodo, metodo_pago, referencia_pago)
        VALUES (:id, CAST(:o AS uuid), :p, 'pendiente', :per, 'mercadopago', :ref)
    """), {"id": sus_id, "o": org_id, "p": plan[0], "per": periodo, "ref": str(r.get("id"))})
    await db.commit()
    return {"suscripcion_id": sus_id, "url_pago": r.get("init_point")}


async def comprar_paquete(db: AsyncSession, org_id: str, correo: Optional[str]) -> Dict[str, Any]:
    if not mp.configurado():
        raise HTTPException(503, "Los pagos en línea aún no están activos. Escríbenos y agregamos tu paquete manualmente.")
    correo = await _correo_org(db, org_id, correo)
    ref = f"AACES:PAQ:{org_id}:{uuid.uuid4().hex[:12]}"
    try:
        r = await mp.crear_pago_unico(
            titulo=f"AACES paquete de {settings.PAQUETE_CANTIDAD} constancias",
            monto=settings.PAQUETE_PRECIO, correo=correo or "cliente@aaces.mx", referencia=ref, retorno="paquete",
        )
    except mp.MercadoPagoError as e:
        raise HTTPException(502, f"No pudimos iniciar el pago: {e}")
    return {"url_pago": r.get("init_point")}


async def cancelar(db: AsyncSession, org_id: str) -> Dict[str, Any]:
    """Deja de cobrar. El acceso sigue hasta el final de lo que ya pagó."""
    a = (await actual(db, org_id))["actual"]
    if not a or a["plan_codigo"] == "trial":
        raise HTTPException(400, "No tienes un plan de pago que cancelar")
    ref = (await db.execute(text("SELECT referencia_pago FROM aaces.suscripciones WHERE id = :id"), {"id": a["id"]})).scalar()
    if a["periodo"] == "mensual" and ref and mp.configurado():
        try:
            await mp.cancelar_suscripcion(ref)
        except mp.MercadoPagoError as e:
            raise HTTPException(502, f"Mercado Pago no confirmó la cancelación: {e}")
    await db.execute(text("""
        UPDATE aaces.suscripciones
        SET estatus = 'cancelada', fecha_fin = COALESCE(pagado_hasta, fecha_fin, CAST(:hoy AS date)), fecha_actualizacion = now()
        WHERE id = :id
    """), {"id": a["id"], "hoy": hoy()})
    await db.commit()
    fin = (await db.execute(text("SELECT fecha_fin FROM aaces.suscripciones WHERE id = :id"), {"id": a["id"]})).scalar()
    return {"estatus": "cancelada", "acceso_hasta": fin.isoformat() if fin else None}


# ---------------------------------------------------------------------------
# Activación (desde el webhook)
# ---------------------------------------------------------------------------

async def _registrar_pago(db: AsyncSession, pago_id: str, org_id: str, sus_id: Optional[str], concepto: str, monto: float, estatus: str) -> bool:
    """True si el pago es nuevo (idempotencia: Mercado Pago reintenta avisos)."""
    r = (await db.execute(text("""
        INSERT INTO aaces.pagos_suscripcion (mp_pago_id, organizacion_id, suscripcion_id, concepto, monto, estatus)
        VALUES (:p, CAST(:o AS uuid), CAST(:s AS uuid), :c, :m, :e)
        ON CONFLICT (mp_pago_id) DO NOTHING RETURNING mp_pago_id
    """), {"p": str(pago_id), "o": org_id, "s": sus_id, "c": concepto, "m": monto, "e": estatus})).fetchone()
    return r is not None


async def _activar(db: AsyncSession, sus_id: str, meses: int) -> None:
    s = (await db.execute(text("""
        SELECT organizacion_id, estatus, periodo, pagado_hasta FROM aaces.suscripciones WHERE id = CAST(:id AS uuid)
    """), {"id": sus_id})).fetchone()
    if not s:
        return
    org_id, estatus, periodo, pagado = str(s[0]), s[1], s[2], s[3]
    d = hoy()
    base = pagado if pagado and pagado >= d else d
    nuevo = await _sumar_meses(db, base, meses)
    gracia = settings.GRACIA_DIAS if periodo == "mensual" else 0
    fin = (await db.execute(text("SELECT CAST(:n AS date) + CAST(:g AS integer)"), {"n": nuevo, "g": gracia})).scalar()

    if estatus in ("pendiente", "abandonada"):
        # Nueva suscripción: reemplaza a la anterior (y deja de cobrarse la mensual vieja)
        viejas = (await db.execute(text("""
            SELECT id, periodo, referencia_pago FROM aaces.suscripciones
            WHERE organizacion_id = CAST(:o AS uuid) AND id <> CAST(:id AS uuid) AND estatus IN ('activa', 'cancelada')
        """), {"o": org_id, "id": sus_id})).fetchall()
        for v in viejas:
            if v[1] == "mensual" and v[2]:
                try:
                    await mp.cancelar_suscripcion(v[2])
                except Exception:
                    logger.exception("No se pudo cancelar en Mercado Pago la suscripción vieja %s", v[0])
        await db.execute(text("""
            UPDATE aaces.suscripciones SET estatus = 'reemplazada', fecha_actualizacion = now()
            WHERE organizacion_id = CAST(:o AS uuid) AND id <> CAST(:id AS uuid) AND estatus IN ('activa', 'cancelada')
        """), {"o": org_id, "id": sus_id})
        await db.execute(text("""
            UPDATE aaces.suscripciones SET estatus = 'activa', fecha_inicio = CAST(:hoy AS date),
                   pagado_hasta = :p, fecha_fin = :f, fecha_actualizacion = now()
            WHERE id = CAST(:id AS uuid)
        """), {"id": sus_id, "hoy": d, "p": nuevo, "f": fin})
    else:
        await db.execute(text("""
            UPDATE aaces.suscripciones SET pagado_hasta = :p, fecha_fin = :f, fecha_actualizacion = now(),
                   estatus = CASE WHEN estatus = 'cancelada' THEN 'cancelada' ELSE 'activa' END
            WHERE id = CAST(:id AS uuid)
        """), {"id": sus_id, "p": nuevo, "f": fin})


async def _suscripcion_por_ref(db: AsyncSession, ref: str):
    if not ref or not ref.startswith("AACES:SUS:"):
        return None
    try:
        sus_id = str(uuid.UUID(ref.split(":")[2]))
    except (ValueError, IndexError):
        return None
    return (await db.execute(text("""
        SELECT s.id, s.organizacion_id, s.periodo, p.precio_mensual, p.precio_anual
        FROM aaces.suscripciones s JOIN aaces.planes p ON p.id = s.plan_id WHERE s.id = CAST(:id AS uuid)
    """), {"id": sus_id})).fetchone()


async def _pago_aprobado(db: AsyncSession, pago: Dict[str, Any]) -> str:
    pago_id = str(pago.get("id"))
    estado = str(pago.get("status") or "")
    ref = str(pago.get("external_reference") or "")
    monto = float(pago.get("transaction_amount") or 0)

    if ref.startswith("AACES:PAQ:"):
        partes = ref.split(":")
        if len(partes) < 4:
            return "referencia inválida"
        org_id = partes[2]
        if estado != "approved":
            return f"paquete {estado}"
        if monto + 0.01 < settings.PAQUETE_PRECIO:
            logger.error("Pago de paquete %s por %s menor al precio", pago_id, monto)
            return "monto insuficiente"
        if not await _registrar_pago(db, pago_id, org_id, None, "paquete", monto, estado):
            return "ya procesado"
        await db.execute(text("""
            INSERT INTO aaces.paquetes_constancias (organizacion_id, cantidad, restantes, referencia_pago, nota)
            VALUES (CAST(:o AS uuid), :c, :c, :ref, 'Compra con Mercado Pago')
        """), {"o": org_id, "c": settings.PAQUETE_CANTIDAD, "ref": pago_id})
        await db.commit()
        return "paquete acreditado"

    s = await _suscripcion_por_ref(db, ref)
    if not s:
        return "sin suscripción"
    sus_id, org_id, periodo = str(s[0]), str(s[1]), s[2]
    esperado = float(s[4] if periodo == "anual" else s[3] or 0)
    if estado == "approved":
        if monto + 0.01 < esperado:
            logger.error("Pago %s por %s menor al esperado %s", pago_id, monto, esperado)
            return "monto insuficiente"
        if not await _registrar_pago(db, pago_id, org_id, sus_id, periodo or "mensual", monto, estado):
            return "ya procesado"
        await _activar(db, sus_id, 12 if periodo == "anual" else 1)
        await db.commit()
        return "activada"
    if estado in ("rejected", "cancelled") and periodo == "mensual":
        if await _registrar_pago(db, pago_id, org_id, sus_id, "mensual", monto, estado):
            from app.services.recordatorios import registrar_pago_fallido
            await db.commit()
            await registrar_pago_fallido(db, org_id, "Mercado Pago no pudo cobrar tu suscripción de AACES",
                                         referencia_id=sus_id, evento=f"mp:{pago_id}")
        return f"cobro {estado}"
    return f"pago {estado}"


async def procesar_aviso(db: AsyncSession, tipo: str, recurso_id: str) -> str:
    """Procesa un aviso (webhook) de Mercado Pago consultando el recurso en la API."""
    if tipo == "payment":
        return await _pago_aprobado(db, await mp.obtener_pago(recurso_id))

    if tipo == "subscription_authorized_payment":
        cobro = await mp.obtener_cobro_suscripcion(recurso_id)
        pago = cobro.get("payment") or {}
        if not pago.get("id"):
            return "cobro sin pago"
        pre = await mp.obtener_suscripcion(str(cobro.get("preapproval_id")))
        detalle = await mp.obtener_pago(str(pago["id"]))
        # El cobro de una suscripción se liga a ella por la referencia de la suscripción
        detalle["external_reference"] = detalle.get("external_reference") or pre.get("external_reference")
        return await _pago_aprobado(db, detalle)

    if tipo == "subscription_preapproval":
        pre = await mp.obtener_suscripcion(recurso_id)
        s = await _suscripcion_por_ref(db, str(pre.get("external_reference") or ""))
        if not s:
            return "sin suscripción"
        if pre.get("status") in ("cancelled", "paused"):
            await db.execute(text("""
                UPDATE aaces.suscripciones
                SET estatus = 'cancelada', fecha_fin = COALESCE(pagado_hasta, fecha_fin), fecha_actualizacion = now()
                WHERE id = :id AND estatus = 'activa'
            """), {"id": s[0]})
            await db.commit()
            return "cancelada en Mercado Pago"
        return f"suscripción {pre.get('status')}"

    return "ignorado"


# ---------------------------------------------------------------------------
# Registro
# ---------------------------------------------------------------------------

async def crear_prueba(db: AsyncSession, org_id: str, activada_por: Optional[str] = None) -> None:
    """Toda cuenta nueva empieza en Prueba. Los planes de pago se activan al pagar."""
    await db.execute(text("""
        INSERT INTO aaces.suscripciones (organizacion_id, plan_id, estatus, periodo, fecha_inicio, fecha_fin, activada_por)
        SELECT CAST(:o AS uuid), id, 'activa', 'prueba', CAST(:hoy AS date), CAST(:hoy AS date) + CAST(:dias AS integer), CAST(:por AS uuid)
        FROM aaces.planes WHERE codigo = 'trial'
    """), {"o": org_id, "hoy": hoy(), "dias": settings.TRIAL_DIAS, "por": activada_por})
