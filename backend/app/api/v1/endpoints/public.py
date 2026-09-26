from datetime import date, datetime, timedelta
from fastapi import APIRouter, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.core.cifrado import descifrar
from app.core.database import get_db
from fastapi import Depends
from app.api.v1.endpoints.validaciones import _log_validation_attempt
from app.services.security import rate_limiter

_MAX_FALLOS = 20
_VENTANA_FALLOS = 15 * 60

router = APIRouter()


@router.get("/p/{pax_id}")
async def public_participant_profile(
    pax_id: str,
    db: AsyncSession = Depends(get_db),
):
    await db.execute(text("SET LOCAL search_path TO aaces"))

    p = (
        await db.execute(
            text("""
                SELECT id, nombre, correo, telefono, empresa
                FROM aaces.participantes
                WHERE pax_id = :pax_id
            """),
            {"pax_id": pax_id},
        )
    ).fetchone()
    if not p:
        raise HTTPException(status_code=404, detail="Participante no encontrado")

    cursos_rows = (
        await db.execute(
            text("""
                SELECT
                  c.nombre, c.codigo_curso,
                  c.fecha_inicio, c.fecha_fin,
                  c.duracion_horas, c.modalidad, c.ciudad,
                  cp.fecha_inicio_vigencia, cp.fecha_expiracion,
                  cp.estado_acreditacion,
                  cl.nombre AS org_nombre
                FROM aaces.curso_participante cp
                JOIN aaces.cursos c ON c.id = cp.curso_id
                JOIN aaces.clientes cl ON cl.id = c.cliente_id
                WHERE cp.participante_id = :pid
                ORDER BY c.fecha_inicio DESC NULLS LAST
            """),
            {"pid": p[0]},
        )
    ).fetchall()

    today = date.today()
    cursos = []
    vigentes = 0
    por_vencer = 0
    vencidos = 0
    org_nombre = None

    for c in cursos_rows:
        fexp = c[8]
        estado_vigencia = "sin_vigencia"
        if fexp:
            if fexp < today:
                estado_vigencia = "vencido"
                vencidos += 1
            elif fexp <= today + timedelta(days=60):
                estado_vigencia = "por_vencer"
                por_vencer += 1
            else:
                estado_vigencia = "vigente"
                vigentes += 1

        if not org_nombre and c[10]:
            org_nombre = c[10]

        cursos.append({
            "curso_nombre": c[0],
            "codigo_curso": c[1],
            "fecha_inicio": c[2].isoformat() if c[2] else None,
            "fecha_fin": c[3].isoformat() if c[3] else None,
            "duracion_horas": c[4],
            "modalidad": c[5],
            "ciudad": c[6],
            "fecha_inicio_vigencia": c[7].isoformat() if c[7] else None,
            "fecha_expiracion": c[8].isoformat() if c[8] else None,
            "estado_acreditacion": bool(c[9]) if c[9] is not None else False,
            "estado_vigencia": estado_vigencia,
        })

    return {
        "nombre": p[1],
        "organizacion": org_nombre,
        "cursos": cursos,
        "total_cursos": len(cursos),
        "vigentes": vigentes,
        "por_vencer": por_vencer,
        "vencidos": vencidos,
    }


# ---------------------------------------------------------------------------
# Lista de espera del directorio (V009) — sin autenticación.
# ---------------------------------------------------------------------------

import re as _re
from pydantic import BaseModel as _BaseModel, Field as _Field
from typing import Optional as _Optional

_EMAIL_RE = _re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class ListaEsperaCreate(_BaseModel):
    nombre: str = _Field(..., min_length=1, max_length=200)
    email: str = _Field(..., min_length=3, max_length=255)
    empresa: _Optional[str] = _Field(None, max_length=200)
    ciudad: _Optional[str] = _Field(None, max_length=100)
    tipo: str = _Field("empresa", pattern="^(empresa|agencia)$")
    mensaje: _Optional[str] = None


@router.post("/lista-espera")
async def registrar_lista_espera(
    payload: ListaEsperaCreate,
    db: AsyncSession = Depends(get_db),
):
    """Captura un lead desde /marketplace. Idempotente ante reintentos."""
    email = payload.email.strip().lower()
    if not _EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Correo electrónico inválido")
    await db.execute(text("SET LOCAL search_path TO aaces"))
    # Anti-duplicado simple: mismo correo+tipo en las últimas 24h → ok sin insertar.
    dup = await db.execute(
        text("""
            SELECT 1 FROM lista_espera
            WHERE email = :email AND tipo = :tipo
              AND fecha_creacion > CURRENT_TIMESTAMP - INTERVAL '24 hours'
            LIMIT 1
        """),
        {"email": email, "tipo": payload.tipo},
    )
    if not dup.fetchone():
        await db.execute(
            text("""
                INSERT INTO lista_espera (nombre, email, empresa, ciudad, tipo, mensaje)
                VALUES (:nombre, :email, :empresa, :ciudad, :tipo, :mensaje)
            """),
            {
                "nombre": payload.nombre.strip(),
                "email": email,
                "empresa": (payload.empresa or "").strip() or None,
                "ciudad": (payload.ciudad or "").strip() or None,
                "tipo": payload.tipo,
                "mensaje": (payload.mensaje or "").strip() or None,
            },
        )
        await db.commit()
    return {"ok": True}


@router.get("/certificado/{codigo}")
async def certificado_publico(
    codigo: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Datos públicos de una constancia/DC-3 para la página que abre el QR.

    Acepta el código de validación o el ID del certificado. Solo expone lo
    necesario para verificar (sin correo ni teléfono del participante). Si la
    constancia venció se devuelve igual, con estado "vencido", para que quien
    la escanea sepa de quién es y desde cuándo no es válida.
    """
    code = (codigo or "").strip().upper()
    if code.startswith("CERT-") and len(code) > 5:
        alt = code[5:]
    else:
        alt = code
    if not code or len(code) > 64:
        raise HTTPException(status_code=400, detail="Código inválido")

    # Solo cuentan los intentos fallidos: verificar muchos certificados reales no bloquea,
    # pero adivinar códigos queda limitado.
    ip = request.client.host if request.client else "0.0.0.0"
    rl_key = f"cert_publico_fallo:{ip}"
    if rate_limiter.get_remaining_attempts(rl_key, _MAX_FALLOS, _VENTANA_FALLOS) <= 0:
        raise HTTPException(status_code=429, detail="Demasiados códigos no válidos. Intenta de nuevo en unos minutos.")

    await db.execute(text("SET LOCAL search_path TO aaces"))
    row = (
        await db.execute(
            text("""
                SELECT cp.id_certificado, cp.codigo_validacion, cp.estado_acreditacion, cp.estado_pago,
                       cp.fecha_emision_certificado, cp.fecha_expiracion, cp.calificacion,
                       p.nombre, p.apellido, p.apellido_paterno, p.apellido_materno,
                       c.nombre, c.codigo_curso, c.fecha_inicio, c.fecha_fin, c.duracion_horas,
                       c.modalidad, c.ciudad, c.empresa_contratante, c.id,
                       o.razon_social, o.nombre_comercial, o.logo_url, o.stps_registro, o.stps_validado,
                       cl.nombre, o.rfc, o.stps_origen, o.stps_consultado_en
                FROM aaces.curso_participante cp
                JOIN aaces.participantes p ON p.id = cp.participante_id
                JOIN aaces.cursos c ON c.id = cp.curso_id
                LEFT JOIN aaces.clientes cl ON cl.id = c.cliente_id
                LEFT JOIN aaces.organizaciones o ON o.id = cl.organizacion_id
                WHERE UPPER(cp.codigo_validacion) IN (:code, :alt)
                   OR UPPER(cp.id_certificado) IN (:code, :alt)
                LIMIT 1
            """),
            {"code": code, "alt": alt},
        )
    ).fetchone()

    ua = request.headers.get("user-agent", "")
    if not row:
        rate_limiter.is_rate_limited(rl_key, _MAX_FALLOS, _VENTANA_FALLOS)
        # No se registra en validaciones_publicas: exige que el código exista (FK)
        raise HTTPException(status_code=404, detail="Certificado no encontrado")

    (id_cert, cod_val, acreditado, estado_pago, f_emision, f_exp, calificacion,
     p_nombre, p_apellido, p_pat, p_mat,
     c_nombre, c_codigo, c_ini, c_fin, c_horas, c_modalidad, c_ciudad, c_empresa, curso_id,
     o_razon, o_comercial, o_logo, o_stps, o_stps_ok, cl_nombre, o_rfc, o_stps_origen, o_stps_consulta) = row

    def _d(v):
        # datetime es subclase de date: hay que revisarlo primero
        if v is None:
            return None
        return v.date() if isinstance(v, datetime) else v

    today = date.today()
    ini, fin, exp = _d(c_ini), _d(c_fin), _d(f_exp)
    en_curso = bool(ini and (fin or ini) and ini <= today <= (fin or ini))
    if exp and exp < today:
        estado = "vencido"
    elif acreditado or (str(estado_pago or "").lower() == "pagado" and en_curso):
        estado = "vigente"
    else:
        estado = "no_acreditado"

    apellidos = " ".join(x for x in [p_pat, p_mat] if x) or (p_apellido or "")
    nombre_completo = " ".join(x for x in [p_nombre, apellidos] if x).strip()

    constancias = []
    try:
        rs = (
            await db.execute(
                text("SELECT nombre, COALESCE(norma, '') FROM aaces.constancias_curso WHERE curso_id = :c ORDER BY nombre"),
                {"c": curso_id},
            )
        ).fetchall()
        constancias = [{"nombre": r[0], "norma": r[1] or None} for r in rs]
    except Exception:
        constancias = []

    verificaciones = 0
    try:
        v = (
            await db.execute(
                text("SELECT COALESCE(SUM(intentos), 0) FROM aaces.validaciones_publicas WHERE UPPER(codigo_validacion) = :c AND resultado = true"),
                {"c": str(cod_val or id_cert or code).upper()},
            )
        ).scalar()
        verificaciones = int(v or 0)
    except Exception:
        verificaciones = 0

    await _log_validation_attempt(db, str(cod_val or id_cert or code), ip, ua, estado == "vigente")

    # Congruencia agente–curso–instructor (Fase 1: declarado por la agencia).
    # Se usa la foto guardada al dar el folio; los DC-3 anteriores a la Fase 1 no la tienen.
    try:
        foto = (await db.execute(text("""
            SELECT congruencia FROM aaces.curso_participante
            WHERE UPPER(codigo_validacion) = :c OR UPPER(id_certificado) = :c LIMIT 1
        """), {"c": str(cod_val or id_cert or code).upper()})).scalar()
        if foto:
            congruencia = {"fuente": "declarado_por_agencia", **{k: foto.get(k) for k in (
                "curso_registrado", "curso_stps_nombre", "instructor", "instructor_en_plantilla")}}
        else:
            congruencia = None
    except Exception:
        congruencia = None

    return {
        "congruencia": congruencia,
        "valido": estado == "vigente",
        "estado": estado,
        "id_certificado": id_cert,
        "codigo_validacion": cod_val,
        "participante": {"nombre": nombre_completo},
        "curso": {
            "nombre": c_nombre,
            "codigo": c_codigo,
            "fecha_inicio": ini.isoformat() if ini else None,
            "fecha_fin": fin.isoformat() if fin else None,
            "duracion_horas": c_horas,
            "modalidad": c_modalidad,
            "ciudad": c_ciudad,
        },
        "fecha_emision": _d(f_emision).isoformat() if f_emision else None,
        "fecha_expiracion": exp.isoformat() if exp else None,
        "calificacion": float(calificacion) if calificacion is not None else None,
        "constancias": constancias,
        "capacitador": {
            "nombre": o_comercial or o_razon or cl_nombre,
            "razon_social": o_razon,
            "logo_url": o_logo,
            "stps_registro": o_stps if o_stps_ok else None,
            # Verificado en el buscador oficial de la STPS (automática) o por AACES (manual)
            "stps_verificado": bool(o_stps_ok),
            "stps_rfc": descifrar(o_rfc) if o_stps_ok else None,
            "stps_origen": o_stps_origen if o_stps_ok else None,
            "stps_consultado_en": o_stps_consulta.isoformat() if (o_stps_ok and o_stps_consulta) else None,
            "stps_fuente": "https://agentes.stps.gob.mx/Buscador/BuscadorAgente.aspx",
        },
        "empresa": c_empresa or None,
        "verificaciones": verificaciones + (1 if estado == "vigente" else 0),
    }
