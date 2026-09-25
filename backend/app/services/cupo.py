"""Límite de constancias (DC-3) por plan.

El conteo y el bloqueo definitivos los hace el trigger aaces.tg_consumo_constancia
(ver bootstrap/schema.py). Aquí está lo que ve el cliente:
- estado(): cuántas lleva, su límite y cuándo se reinicia.
- verificar(): revisión previa para dar un mensaje claro antes de emitir un grupo.
- avisar(): avisos al 80% y 100% (panel + correo), una sola vez por periodo.
"""
import asyncio
import logging
from datetime import date
from typing import Any, Dict, Iterable, Optional

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

ERROR_TRIGGER = "CUPO_CONSTANCIAS_AGOTADO"


async def estado(db: AsyncSession, org_id: str) -> Dict[str, Any]:
    r = (await db.execute(text("SELECT * FROM aaces.cupo_constancias(CAST(:o AS uuid))"), {"o": org_id})).mappings().first()
    r = dict(r or {})
    limite = int(r.get("limite") or 0)
    usados = int(r.get("usados") or 0)
    extra = int(r.get("extra") or 0)
    ilimitado = bool(r.get("ilimitado"))
    activa = bool(r.get("activa"))
    restantes_plan = None if ilimitado else max(limite - usados, 0)
    disponibles = None if ilimitado else (restantes_plan + extra if activa else 0)
    return {
        "plan_codigo": r.get("plan_codigo"),
        "plan_nombre": r.get("plan_nombre"),
        "activa": activa,
        "es_prueba": bool(r.get("es_prueba")),
        "ilimitado": ilimitado,
        "limite": None if ilimitado else limite,
        "usados": usados,
        "restantes_plan": restantes_plan,
        "extra": extra,
        "disponibles": disponibles,
        "porcentaje": None if ilimitado or not limite else min(round(usados * 100 / limite), 100),
        "periodo_inicio": r["periodo_inicio"].isoformat() if r.get("periodo_inicio") else None,
        "periodo_fin": r["periodo_fin"].isoformat() if r.get("periodo_fin") else None,
    }


async def historial(db: AsyncSession, org_id: str, meses: int = 6) -> list:
    rows = (await db.execute(
        text("""
            SELECT to_char(date_trunc('month', fecha AT TIME ZONE 'America/Mexico_City'), 'YYYY-MM') AS mes,
                   count(*)::int
            FROM aaces.consumo_constancias
            WHERE organizacion_id = CAST(:o AS uuid)
              AND fecha >= date_trunc('month', now()) - make_interval(months => :m - 1)
            GROUP BY 1 ORDER BY 1
        """),
        {"o": org_id, "m": meses},
    )).fetchall()
    return [{"mes": r[0], "emitidas": r[1]} for r in rows]


async def nuevos_de(db: AsyncSession, cp_ids: Iterable[str]) -> int:
    """Cuántos de estos participantes aún no tienen constancia (los demás no cuentan)."""
    ids = [str(i) for i in cp_ids if i]
    if not ids:
        return 0
    r = await db.execute(
        text("""
            SELECT count(*) FROM aaces.curso_participante cp
            WHERE cp.id = ANY(CAST(:ids AS uuid[]))
              AND COALESCE(cp.codigo_validacion, '') = ''
              AND NOT EXISTS (SELECT 1 FROM aaces.consumo_constancias c WHERE c.curso_participante_id = cp.id)
        """),
        {"ids": ids},
    )
    return int(r.scalar() or 0)


def _mensaje(e: Dict[str, Any], requeridos: int) -> str:
    if not e["activa"]:
        return "Tu suscripción no está activa. Renueva tu plan para emitir constancias nuevas."
    disp = e["disponibles"] or 0
    if requeridos == 1 or disp == 0:
        base = "Ya usaste todas las constancias de tu plan" + (" de prueba." if e["es_prueba"] else " este mes.")
    else:
        base = f"Este grupo usa {requeridos} constancias y te quedan {disp}."
    return base + " Elige menos participantes, compra un paquete extra o sube de plan."


async def verificar(db: AsyncSession, org_id: str, requeridos: int) -> None:
    """Lanza 402 con un mensaje claro si no alcanzan. No genera nada a medias."""
    if requeridos <= 0:
        return
    e = await estado(db, org_id)
    if e["activa"] and e["ilimitado"]:
        return
    if e["activa"] and (e["disponibles"] or 0) >= requeridos:
        return
    raise HTTPException(status_code=402, detail=_mensaje(e, requeridos))


def es_error_cupo(exc: BaseException) -> bool:
    return ERROR_TRIGGER in str(exc)


def http_error_cupo() -> HTTPException:
    return HTTPException(
        status_code=402,
        detail="Llegaste al límite de constancias de tu plan. Compra un paquete extra o sube de plan.",
    )


# ---------------------------------------------------------------------------
# Avisos al 80% y 100%
# ---------------------------------------------------------------------------

def _fecha_legible(iso: Optional[str]) -> str:
    if not iso:
        return ""
    meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
             "septiembre", "octubre", "noviembre", "diciembre"]
    d = date.fromisoformat(iso)
    return f"{d.day} de {meses[d.month - 1]}"


async def avisar(db: AsyncSession, org_id: str) -> None:
    """Registra (y envía por correo) el aviso del 80% o 100% si corresponde.
    Idempotente: la clave incluye el periodo, así que se avisa una vez por nivel."""
    from app.services.recordatorios import _enviar_correo, _registrar_aviso, correos_admin_org

    e = await estado(db, org_id)
    if not e["activa"] or e["ilimitado"] or not e["limite"]:
        return
    pct = e["usados"] * 100 / e["limite"]
    nivel = 100 if pct >= 100 else 80 if pct >= 80 else None
    if not nivel:
        return
    periodo = e["periodo_inicio"] or "prueba"
    reinicio = f" Tu cupo se reinicia el {_fecha_legible(e['periodo_fin'])}." if e["periodo_fin"] else ""
    if nivel == 100:
        titulo = "Llegaste al límite de constancias de tu plan"
        mensaje = (f"Emitiste {e['usados']} de {e['limite']} constancias."
                   + (f" Te quedan {e['extra']} de tus paquetes extra." if e["extra"] else
                      " Para seguir emitiendo compra un paquete extra o sube de plan.")
                   + reinicio)
    else:
        titulo = "Vas en el 80% de tus constancias"
        mensaje = (f"Emitiste {e['usados']} de {e['limite']} constancias de tu plan {e['plan_nombre'] or ''}."
                   f" Te quedan {e['restantes_plan']}." + reinicio)

    correos = await correos_admin_org(db, org_id)
    aviso = {
        "organizacion_id": org_id,
        "tipo": "cupo_constancias",
        "clave": f"cupo:{periodo}:{nivel}",
        "titulo": titulo,
        "mensaje": mensaje,
        "destinatario": correos[0] if correos else None,
    }
    nuevo = await _registrar_aviso(db, aviso)
    await db.commit()
    if not nuevo:
        return
    ok, error = await _enviar_correo(aviso["destinatario"], f"AACES · {titulo}", mensaje)
    estado_mail = "enviado" if ok else ("omitido" if error == "SMTP no configurado en el servidor" else "fallido")
    await db.execute(
        text("""UPDATE aaces.notificaciones SET email_estado = CAST(:e AS VARCHAR), email_error = :err,
                fecha_envio = CASE WHEN CAST(:e AS VARCHAR) = 'enviado' THEN CURRENT_TIMESTAMP END WHERE id = :id"""),
        {"e": estado_mail, "err": error, "id": nuevo},
    )
    await db.commit()


def avisar_en_segundo_plano(org_id: Optional[str]) -> None:
    """Después de emitir: revisa los avisos con su propia sesión, sin frenar la respuesta."""
    if not org_id:
        return

    async def _run():
        from app.core.database import AsyncSessionLocal
        async with AsyncSessionLocal() as s:
            try:
                await avisar(s, str(org_id))
            except Exception:
                logger.exception("No se pudo registrar el aviso de cupo de %s", org_id)

    try:
        asyncio.get_running_loop().create_task(_run())
    except RuntimeError:
        pass


async def verificar_participantes(db: AsyncSession, cp_ids: Iterable[str]) -> Optional[str]:
    """Para los caminos de la agenda: revisa el cupo de la organización dueña de
    estos participantes. Devuelve el id de la organización (para el aviso)."""
    ids = [str(i) for i in cp_ids if i]
    if not ids:
        return None
    org = (await db.execute(
        text("""
            SELECT cl.organizacion_id FROM aaces.curso_participante cp
            JOIN aaces.cursos c ON c.id = cp.curso_id
            JOIN aaces.clientes cl ON cl.id = c.cliente_id
            WHERE cp.id = CAST(:id AS uuid)
        """),
        {"id": ids[0]},
    )).scalar()
    if not org:
        return None
    await verificar(db, str(org), await nuevos_de(db, ids))
    return str(org)
