"""
ParticipanteService — ÚNICA fuente de verdad del dominio Participante (Sprint S2).

Elimina la duplicación repartida en:
  - cursos.py:add_participante        (enroll con INSERT participante + curso_participante)
  - clientes.py:add_participante_curso (INSERT participante con apellidos/ciudad)
  - participantes.py:crear_participante (INSERT participante con organizacion_id)
  - participantes.py:acreditar_participante (UPDATE curso_participante)

Regla #1: una operación del negocio = un método del servicio.
Regla #2: los routers NO conocen SQL (solo delegan).
Regla #4: todo filtra por organizacion_id (tenant).
"""

import uuid
from typing import Optional, Any
from sqlalchemy import text
from fastapi import HTTPException

from app.core.tenant import organization_id as _organization_id


def _org_id_of(user_data: dict) -> Optional[str]:
    return _organization_id(user_data)


def _to_dict(payload: Any) -> dict:
    if hasattr(payload, "dict"):
        try:
            return payload.dict(exclude_unset=True)
        except Exception:
            return dict(payload)
    return dict(payload)


async def crear(db, user_data: dict, payload: Any, curso_id: Optional[str] = None) -> dict:
    """Registrar un participante. Reusa por correo si ya existe.
    Si curso_id se pasa, crea el enlace curso_participante (enroll).
    Devuelve {id, participante_id, curso_participante_id} (curso_participante_id=None si no aplica)."""
    org_id = _org_id_of(user_data)
    if not org_id:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")

    data = _to_dict(payload)
    nombre = (str(data.get("nombre") or "").strip())
    correo = (str(data.get("correo") or "").strip().lower())
    if not (nombre and correo):
        raise HTTPException(status_code=400, detail="nombre y correo requeridos")

    await db.execute(text("SET LOCAL search_path TO aaces"))

    # Reusar participante existente por correo (mismo tenant)
    ex = await db.execute(
        text("SELECT id FROM aaces.participantes WHERE correo = :correo AND organizacion_id = :org LIMIT 1"),
        {"correo": correo, "org": org_id},
    )
    row = ex.fetchone()
    if row:
        pid = row[0]
    else:
        pax_id = f"PAX-{uuid.uuid4().hex[:8].upper()}"
        # Campos opcionales (apellidos, ciudad, profesion) tolerados como None
        ap_pat = (str(data.get("apellido_paterno") or data.get("apellido") or "").strip()) or None
        ap_mat = (str(data.get("apellido_materno") or "").strip()) or None
        ciudad = data.get("ciudad_origen") or data.get("ciudad") or None
        profesion = data.get("nivel_educacion") or data.get("profesion") or None
        ins = await db.execute(
            text("""
                INSERT INTO aaces.participantes
                    (id, pax_id, nombre, correo, telefono, empresa, cargo, ciudad_origen,
                     apellido_paterno, apellido_materno, nivel_educacion, cliente_id, organizacion_id, pais)
                VALUES (gen_random_uuid(), :pax_id, :nombre, :correo, :telefono, :empresa, :cargo, :ciudad,
                        :ap_pat, :ap_mat, :profesion, :cid, :org_id, 'Mexico')
                RETURNING id
            """),
            {
                "pax_id": pax_id,
                "nombre": nombre,
                "correo": correo,
                "telefono": data.get("telefono") or None,
                "empresa": data.get("empresa") or None,
                "cargo": data.get("cargo") or None,
                "ciudad": ciudad,
                "ap_pat": ap_pat,
                "ap_mat": ap_mat,
                "profesion": profesion,
                "cid": org_id,
                "org_id": org_id,
            },
        )
        pid = ins.scalar()

    curso_participante_id = None
    if curso_id:
        # Verificar que el curso pertenece al tenant
        own = await db.execute(
            text("SELECT 1 FROM aaces.cursos WHERE id = :id AND organizacion_id = :org LIMIT 1"),
            {"id": curso_id, "org": org_id},
        )
        if own.scalar() is None:
            raise HTTPException(status_code=404, detail="Curso no encontrado")
        # Evitar enlace duplicado
        ex_cp = await db.execute(
            text("SELECT id FROM aaces.curso_participante WHERE curso_id = :curso AND participante_id = :pid LIMIT 1"),
            {"curso": curso_id, "pid": pid},
        )
        cp_row = ex_cp.fetchone()
        if cp_row:
            curso_participante_id = cp_row[0]
        else:
            # Calcular vigencia y costo asignado (lógica de negocio centralizada)
            curs = await db.execute(
                text("""
                    SELECT fecha_inicio, fecha_fin, vigencia_meses, duracion_validacion, grupo_id,
                           cliente_id, nombre, costo_total
                    FROM aaces.cursos WHERE id = :curso
                """),
                {"curso": curso_id},
            )
            cr = curs.fetchone()
            fi = cr[0]; ff = cr[1]; vig = cr[2]; durv = cr[3]; grupo_id = cr[4]
            cli_id = cr[5]; cnombre = cr[6]; costo_total = cr[7]
            base = ff or fi or None
            fecha_inicio_vig = base
            fecha_expiracion = None
            if base is not None:
                meses = vig if (vig or 0) > 0 else (durv if (durv or 0) > 0 else None)
                if meses:
                    try:
                        fecha_expiracion = base + __import__("datetime").timedelta(days=int(meses) * 30)
                    except Exception:
                        fecha_expiracion = None
            # costo asignado: grupos_curso -> tipos_curso -> costo_total
            costo = 0
            if grupo_id:
                g = await db.execute(
                    text("SELECT precio_base, precio_promocional FROM aaces.grupos_curso WHERE id = :gid LIMIT 1"),
                    {"gid": grupo_id},
                )
                gr = g.fetchone()
                if gr:
                    costo = float(gr[0] if gr[0] is not None else (gr[1] or 0))
            if not costo and cli_id and cnombre:
                t = await db.execute(
                    text("SELECT costo_por_persona FROM aaces.tipos_curso WHERE cliente_id = :cid AND nombre = :nm LIMIT 1"),
                    {"cid": cli_id, "nm": cnombre},
                )
                tr = t.fetchone()
                if tr and tr[0]:
                    costo = float(tr[0])
            if not costo:
                costo = float(costo_total or 0)
            lnk = await db.execute(
                text("""
                    INSERT INTO aaces.curso_participante
                        (id, curso_id, participante_id, estado_pago, estado_acreditacion,
                         fecha_inicio_vigencia, fecha_expiracion, valor_pagado, costo_asignado, descuento)
                    VALUES (gen_random_uuid(), :curso, :pid, 'pendiente', false,
                            :fiv, :fexp, 0, :costo, 0)
                    RETURNING id
                """),
                {
                    "curso": curso_id, "pid": pid, "fiv": fecha_inicio_vig,
                    "fexp": fecha_expiracion, "costo": costo,
                },
            )
            curso_participante_id = lnk.scalar()

    return {
        "id": str(curso_participante_id) if curso_participante_id else str(pid),
        "participante_id": str(pid),
        "curso_participante_id": str(curso_participante_id) if curso_participante_id else None,
    }


async def acreditar(db, user_data: dict, participante_id: str, calificacion: Optional[float] = None) -> dict:
    """Marcar un participante como acreditado en el curso del tenant.
    Busca el curso_participante por participante_id + organizacion_id del curso."""
    org_id = _org_id_of(user_data)
    if not org_id:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")

    await db.execute(text("SET LOCAL search_path TO aaces"))
    cp = await db.execute(
        text("""
            SELECT cp.id FROM aaces.curso_participante cp
            JOIN aaces.cursos c ON c.id = cp.curso_id
            WHERE cp.participante_id = :pid AND c.organizacion_id = :org
            LIMIT 1
        """),
        {"pid": participante_id, "org": org_id},
    )
    cp_row = cp.fetchone()
    if not cp_row:
        raise HTTPException(status_code=404, detail="Participante no encontrado en tus cursos")

    await db.execute(
        text("UPDATE aaces.curso_participante SET estado_acreditacion = true, calificacion = :cal, fecha_acreditacion = NOW() WHERE id = :id"),
        {"cal": calificacion, "id": cp_row[0]},
    )
    return {"status": "acreditado", "calificacion": calificacion, "fecha_acreditacion": "NOW()"}
