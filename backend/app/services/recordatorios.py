"""Job diario de recordatorios AACES.

Genera avisos para los administradores de cada organización (los clientes de
AACES) y los envía por correo. Cada aviso también queda registrado en la tabla
``notificaciones``, que alimenta el centro de notificaciones in-app.

Idempotencia: cada aviso tiene una ``clave`` determinística
(tipo:referencia:variante) con UNIQUE por organización. El job puede correrse
varias veces al día (reintentos, catch-up al arranque) sin duplicar avisos.

Eventos:
  1. constancia_por_vencer  (30/15/7 días antes de fecha_expiracion)
  2. curso_proximo          (7/3/1 días antes de fecha_inicio)
  3. suscripcion_por_vencer (7 días antes de fecha_fin)
  4. pago_fallido           (inmediato; lo dispara el webhook de MercadoPago)
  5. curso_sin_participantes (curso inicia en <= 7 días y no tiene inscritos)

Zona horaria: America/Mexico_City (hora de Steve / operación en México).
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import date, datetime
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import bindparam, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.services.email import email_service

logger = logging.getLogger(__name__)

TZ = ZoneInfo("America/Mexico_City")

# (tipo, días antes) para los eventos programados por fecha
DIAS_CONSTANCIA = (30, 15, 7)
DIAS_CURSO = (7, 3, 1)
DIAS_SUSCRIPCION = 7
DIAS_CURSO_SIN_PARTICIPANTES = 7


def hoy() -> date:
    """Fecha actual en la zona horaria de operación."""
    return datetime.now(TZ).date()


def nombre_completo(row: Any) -> str:
    partes = [row.nombre, row.apellido_paterno, row.apellido_materno]
    return " ".join(p for p in partes if p).strip() or "Participante"


async def correos_admin_org(db: AsyncSession, organizacion_id: str) -> list[str]:
    """Correos de los admins activos de la org; fallback a email_contacto."""
    rows = (
        await db.execute(
            text(
                """
                SELECT correo FROM aaces.usuarios
                WHERE organizacion_id = :org
                  AND rol = 'admin'
                  AND activo = true
                """
            ),
            {"org": organizacion_id},
        )
    ).fetchall()
    correos = [r[0] for r in rows if r[0]]
    if not correos:
        row = (
            await db.execute(
                text("SELECT email_contacto FROM aaces.organizaciones WHERE id = :org"),
                {"org": organizacion_id},
            )
        ).fetchone()
        if row and row[0]:
            correos = [row[0]]
    return correos


# ---------------------------------------------------------------------------
# Colectores: cada uno devuelve la lista de avisos a generar.
# ---------------------------------------------------------------------------

async def constancias_por_vencer(db: AsyncSession, ref: date) -> list[dict]:
    objetivos = {d: ref.fromordinal(ref.toordinal() + d) for d in DIAS_CONSTANCIA}
    rows = (
        await db.execute(
            text(
                """
                SELECT cp.id AS cp_id, cp.fecha_expiracion, cp.id_certificado AS folio,
                       p.nombre, p.apellido_paterno, p.apellido_materno,
                       p.correo AS p_correo, p.telefono AS p_telefono,
                       c.nombre AS curso_nombre, c.codigo_curso,
                       cl.organizacion_id AS org_id
                FROM aaces.curso_participante cp
                JOIN aaces.participantes p ON p.id = cp.participante_id
                JOIN aaces.cursos c ON c.id = cp.curso_id
                JOIN aaces.clientes cl ON cl.id = c.cliente_id
                WHERE cp.fecha_expiracion IN :fechas
                  AND cp.id_certificado IS NOT NULL
                  AND cl.organizacion_id IS NOT NULL
                """
            ).bindparams(bindparam("fechas", expanding=True)),
            {"fechas": tuple(objetivos.values())},
        )
    ).mappings().all()
    avisos = []
    for r in rows:
        dias = (r["fecha_expiracion"] - ref).days
        if dias not in DIAS_CONSTANCIA:
            continue
        nombre = nombre_completo(r)
        contacto = r["p_correo"] or r["p_telefono"] or "sin datos de contacto"
        avisos.append(
            {
                "organizacion_id": str(r["org_id"]),
                "tipo": "constancia_por_vencer",
                "clave": f"constancia_por_vencer:{r['cp_id']}:{dias}",
                "titulo": f"Constancia por vencer en {dias} días",
                "mensaje": (
                    f"La constancia {r['folio']} de {nombre} "
                    f"(curso {r['curso_nombre']}, {r['codigo_curso']}) "
                    f"vence el {r['fecha_expiracion'].isoformat()} "
                    f"(faltan {dias} días). "
                    f"Datos del participante para ofrecerle la renovación: {contacto}."
                ),
                "asunto": f"AACES: constancia de {nombre} vence en {dias} días",
                "referencia_tipo": "curso_participante",
                "referencia_id": str(r["cp_id"]),
                "dias_restantes": dias,
            }
        )
    return avisos


async def cursos_proximos(db: AsyncSession, ref: date) -> list[dict]:
    fechas = [date.fromordinal(ref.toordinal() + d) for d in DIAS_CURSO]
    rows = (
        await db.execute(
            text(
                """
                SELECT c.id AS curso_id, c.nombre AS curso_nombre,
                       c.codigo_curso, c.fecha_inicio, c.ciudad,
                       cl.organizacion_id AS org_id,
                       COUNT(cp.participante_id) AS inscritos
                FROM aaces.cursos c
                JOIN aaces.clientes cl ON cl.id = c.cliente_id
                LEFT JOIN aaces.curso_participante cp ON cp.curso_id = c.id
                WHERE c.fecha_inicio IN :fechas
                  AND c.estado <> 'cancelado'
                  AND cl.organizacion_id IS NOT NULL
                GROUP BY c.id, c.nombre, c.codigo_curso, c.fecha_inicio,
                         c.ciudad, cl.organizacion_id
                """
            ).bindparams(bindparam("fechas", expanding=True)),
            {"fechas": tuple(fechas)},
        )
    ).mappings().all()
    avisos = []
    for r in rows:
        dias = (r["fecha_inicio"] - ref).days
        if dias not in DIAS_CURSO:
            continue
        avisos.append(
            {
                "organizacion_id": str(r["org_id"]),
                "tipo": "curso_proximo",
                "clave": f"curso_proximo:{r['curso_id']}:{dias}",
                "titulo": f"Tu curso inicia en {dias} días",
                "mensaje": (
                    f"El curso {r['curso_nombre']} ({r['codigo_curso']}) "
                    f"inicia el {r['fecha_inicio'].isoformat()} en {r['ciudad']}. "
                    f"Participantes inscritos: {r['inscritos']}."
                ),
                "asunto": f"AACES: tu curso {r['codigo_curso']} inicia en {dias} días",
                "referencia_tipo": "curso",
                "referencia_id": str(r["curso_id"]),
                "dias_restantes": dias,
            }
        )
    return avisos


async def suscripciones_por_vencer(db: AsyncSession, ref: date) -> list[dict]:
    objetivo = date.fromordinal(ref.toordinal() + DIAS_SUSCRIPCION)
    rows = (
        await db.execute(
            text(
                """
                SELECT s.id AS sub_id, s.fecha_fin, s.organizacion_id AS org_id,
                       pl.nombre AS plan_nombre, pl.codigo AS plan_codigo
                FROM aaces.suscripciones s
                JOIN aaces.planes pl ON pl.id = s.plan_id
                WHERE s.fecha_fin = :fecha
                  AND s.estatus = 'activa'
                  -- las mensuales se cobran solas en Mercado Pago: no hay que renovar
                  AND COALESCE(s.periodo, '') <> 'mensual'
                """
            ),
            {"fecha": objetivo},
        )
    ).mappings().all()
    return [
        {
            "organizacion_id": str(r["org_id"]),
            "tipo": "suscripcion_por_vencer",
            # La fecha en la clave permite volver a avisar en la siguiente renovación anual
            "clave": f"suscripcion_por_vencer:{r['sub_id']}:{r['fecha_fin'].isoformat()}",
            "titulo": ("Tu prueba de AACES termina en 7 días" if r["plan_codigo"] == "trial"
                       else "Tu suscripción AACES vence en 7 días"),
            "mensaje": (
                f"Tu prueba termina el {r['fecha_fin'].isoformat()}. Elige un plan para seguir "
                f"emitiendo constancias; lo que ya emitiste sigue siendo válido."
                if r["plan_codigo"] == "trial" else
                f"Tu suscripción al plan {r['plan_nombre']} vence el "
                f"{r['fecha_fin'].isoformat()}. Renuévala a tiempo para no "
                f"interrumpir el servicio."
            ),
            "asunto": "AACES: tu suscripción vence en 7 días",
            "referencia_tipo": "suscripcion",
            "referencia_id": str(r["sub_id"]),
            "dias_restantes": DIAS_SUSCRIPCION,
        }
        for r in rows
    ]


async def cursos_sin_participantes(db: AsyncSession, ref: date) -> list[dict]:
    d1 = date.fromordinal(ref.toordinal() + 1)
    d7 = date.fromordinal(ref.toordinal() + DIAS_CURSO_SIN_PARTICIPANTES)
    rows = (
        await db.execute(
            text(
                """
                SELECT c.id AS curso_id, c.nombre AS curso_nombre,
                       c.codigo_curso, c.fecha_inicio, c.ciudad,
                       cl.organizacion_id AS org_id
                FROM aaces.cursos c
                JOIN aaces.clientes cl ON cl.id = c.cliente_id
                LEFT JOIN aaces.curso_participante cp ON cp.curso_id = c.id
                WHERE c.fecha_inicio BETWEEN :d1 AND :d7
                  AND c.estado <> 'cancelado'
                  AND cl.organizacion_id IS NOT NULL
                GROUP BY c.id, c.nombre, c.codigo_curso, c.fecha_inicio,
                         c.ciudad, cl.organizacion_id
                HAVING COUNT(cp.participante_id) = 0
                """
            ),
            {"d1": d1, "d7": d7},
        )
    ).mappings().all()
    return [
        {
            "organizacion_id": str(r["org_id"]),
            "tipo": "curso_sin_participantes",
            "clave": f"curso_sin_participantes:{r['curso_id']}",
            "titulo": "Curso próximo sin participantes",
            "mensaje": (
                f"El curso {r['curso_nombre']} ({r['codigo_curso']}) inicia el "
                f"{r['fecha_inicio'].isoformat()} en {r['ciudad']} y aún no "
                f"tiene participantes inscritos."
            ),
            "asunto": f"AACES: {r['codigo_curso']} inicia pronto y no tiene inscritos",
            "referencia_tipo": "curso",
            "referencia_id": str(r["curso_id"]),
            "dias_restantes": (r["fecha_inicio"] - ref).days,
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# Ejecución
# ---------------------------------------------------------------------------

def _smtp_configurado() -> bool:
    return bool(settings.SMTP_USERNAME and settings.SMTP_PASSWORD)


async def _enviar_correo(destinatario: str, asunto: str, mensaje: str) -> tuple[bool, str | None]:
    """Envía el correo en un hilo (smtplib es bloqueante)."""
    if not destinatario:
        return False, "sin destinatario"
    if not _smtp_configurado():
        return False, "SMTP no configurado en el servidor"
    try:
        ok = await asyncio.to_thread(
            email_service.send_email, destinatario, asunto, mensaje
        )
        return (True, None) if ok else (False, "fallo el envío SMTP")
    except Exception as e:  # noqa: BLE001 - se registra en la fila
        logger.exception("Error enviando recordatorio a %s", destinatario)
        return False, str(e)[:500]


async def _registrar_aviso(db: AsyncSession, aviso: dict) -> str | None:
    """Inserta el aviso si su clave no existe. Devuelve el id o None si ya existía."""
    row = (
        await db.execute(
            text(
                """
                INSERT INTO aaces.notificaciones
                    (organizacion_id, tipo, clave, titulo, mensaje,
                     destinatario_correo, referencia_tipo, referencia_id, dias_restantes)
                VALUES (:org, :tipo, :clave, :titulo, :mensaje,
                        :dest, :ref_tipo, :ref_id, :dias)
                ON CONFLICT (organizacion_id, clave) DO NOTHING
                RETURNING id
                """
            ),
            {
                "org": aviso["organizacion_id"],
                "tipo": aviso["tipo"],
                "clave": aviso["clave"],
                "titulo": aviso["titulo"],
                "mensaje": aviso["mensaje"],
                "dest": aviso.get("destinatario"),
                "ref_tipo": aviso.get("referencia_tipo"),
                "ref_id": aviso.get("referencia_id"),
                "dias": aviso.get("dias_restantes"),
            },
        )
    ).fetchone()
    return str(row[0]) if row else None


async def ejecutar_recordatorios(db: AsyncSession, ref: date | None = None) -> dict:
    """Corre el job diario. Devuelve resumen {generados, enviados, fallidos, omitidos}."""
    ref = ref or hoy()
    resumen = {"generados": 0, "enviados": 0, "fallidos": 0, "omitidos": 0}

    colectores = [
        constancias_por_vencer,
        cursos_proximos,
        suscripciones_por_vencer,
        cursos_sin_participantes,
    ]
    avisos: list[dict] = []
    for colector in colectores:
        try:
            avisos.extend(await colector(db, ref))
        except Exception:  # noqa: BLE001 - un colector no tumba a los demás
            logger.exception("Colector de recordatorios falló: %s", colector.__name__)
            try:
                await db.rollback()  # la transacción pudo quedar abortada
            except Exception:
                pass

    for aviso in avisos:
        # Resolver destinatarios (admins de la org) al momento de generar
        correos = await correos_admin_org(db, aviso["organizacion_id"])
        aviso["destinatario"] = correos[0] if correos else None

        nuevo_id = await _registrar_aviso(db, aviso)
        if not nuevo_id:
            continue  # ya existía: idempotente, no reenviar
        resumen["generados"] += 1

        ok, error = await _enviar_correo(
            aviso["destinatario"], aviso["asunto"], aviso["mensaje"]
        )
        estado = "enviado" if ok else ("omitido" if error == "SMTP no configurado en el servidor" else "fallido")
        resumen[{"enviado": "enviados", "fallido": "fallidos", "omitido": "omitidos"}[estado]] += 1
        await db.execute(
            text(
                """
                UPDATE aaces.notificaciones
                SET email_estado = CAST(:estado AS VARCHAR),
                    email_error = :error,
                    fecha_envio = CASE WHEN CAST(:estado AS VARCHAR) = 'enviado'
                                      THEN CURRENT_TIMESTAMP END
                WHERE id = :nid
                """
            ),
            {"estado": estado, "error": error, "nid": nuevo_id},
        )

    await db.commit()

    # Avisos de cupo de constancias (80% / 100%); idempotentes por periodo
    try:
        from app.services import cupo
        orgs = (await db.execute(text(
            "SELECT DISTINCT organizacion_id FROM aaces.suscripciones WHERE estatus = 'activa'"
        ))).fetchall()
        for (org,) in orgs:
            await cupo.avisar(db, str(org))
    except Exception:  # noqa: BLE001
        logger.exception("Avisos de cupo fallaron")
        await db.rollback()

    logger.info("Job de recordatorios %s: %s", ref.isoformat(), resumen)
    return resumen


async def registrar_pago_fallido(
    db: AsyncSession,
    organizacion_id: str,
    detalle: str,
    referencia_id: str | None = None,
    evento: str | None = None,
) -> str | None:
    """Hook inmediato para pagos/renovaciones fallidas (webhook de Mercado Pago).

    referencia_id es un UUID interno (p. ej. la suscripción); evento identifica
    el intento (p. ej. el id del pago en Mercado Pago) para no repetir el aviso.
    """
    evento = evento or referencia_id or uuid.uuid4().hex[:12]
    aviso = {
        "organizacion_id": organizacion_id,
        "tipo": "pago_fallido",
        "clave": f"pago_fallido:{evento}",
        "titulo": "Pago o renovación automática fallida",
        "mensaje": (
            "Tu pago o renovación automática no pudo procesarse. "
            f"Detalle: {detalle.rstrip('.')}. Revisa tu método de pago para evitar "
            "la interrupción del servicio."
        ),
        "asunto": "AACES: tu pago no pudo procesarse",
        "referencia_tipo": "pago",
        "referencia_id": referencia_id,
        "dias_restantes": 0,
    }
    correos = await correos_admin_org(db, organizacion_id)
    aviso["destinatario"] = correos[0] if correos else None
    nuevo_id = await _registrar_aviso(db, aviso)
    if not nuevo_id:
        return None
    ok, error = await _enviar_correo(aviso["destinatario"], aviso["asunto"], aviso["mensaje"])
    estado = "enviado" if ok else ("omitido" if error == "SMTP no configurado en el servidor" else "fallido")
    await db.execute(
        text(
            """
            UPDATE aaces.notificaciones
            SET email_estado = CAST(:estado AS VARCHAR), email_error = :error,
                fecha_envio = CASE WHEN CAST(:estado AS VARCHAR) = 'enviado'
                                   THEN CURRENT_TIMESTAMP END
            WHERE id = :nid
            """
        ),
        {"estado": estado, "error": error, "nid": nuevo_id},
    )
    await db.commit()
    return nuevo_id
