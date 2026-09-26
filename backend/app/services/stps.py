"""Verificación de agentes capacitadores contra el registro público de la STPS.

Fuente: https://agentes.stps.gob.mx/Buscador/BuscadorAgente.aspx (buscador oficial,
sin API). Es una página ASP.NET: hay que enviar su estado (__VIEWSTATE...) y las
cabeceras Referer/Origin. Por ser una página y no una API puede cambiar sin aviso:
por eso se guarda cada consulta con su fecha, nunca se consulta al escanear un QR
(se usa lo guardado) y un error de la STPS no le quita la validación a nadie.

Lo que se lee de cada registro: RFC, razón social, domicilio, tipo de agente,
estatus (en lo observado siempre "Activo"; un RFC que no aparece se trata como
"no encontrado", no como dado de baja), número de cursos y de instructores.
Un mismo RFC puede aparecer varias veces (una por sede o domicilio).
"""
import html
import json
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cifrado import cifrar, descifrar

logger = logging.getLogger(__name__)

BUSCADOR = "https://agentes.stps.gob.mx/Buscador/BuscadorAgente.aspx"
ORIGEN = "https://agentes.stps.gob.mx"
RFC_VALIDO = re.compile(r"^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$")


class StpsNoDisponible(Exception):
    """La consulta no se pudo hacer (sitio caído, cambió la página...)."""


def normalizar_rfc(rfc: Optional[str]) -> str:
    return re.sub(r"[\s-]", "", (rfc or "").upper())


def _oculto(nombre: str, pagina: str) -> str:
    m = re.search(r'id="%s" value="([^"]*)"' % nombre, pagina)
    return html.unescape(m.group(1)) if m else ""


def _limpiar(celda: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", celda))).strip()


def _leer_resultados(pagina: str, rfc: str) -> List[Dict[str, Any]]:
    registros = []
    for fila in re.findall(r"<tr>(.*?)</tr>", pagina, re.S):
        celdas = [_limpiar(c) for c in re.findall(r"<td[^>]*>(.*?)</td>", fila, re.S)]
        if len(celdas) < 8 or normalizar_rfc(celdas[1]) != rfc:
            continue
        numero = lambda v: int(v) if v.isdigit() else None  # noqa: E731
        registros.append({
            "rfc": normalizar_rfc(celdas[1]),
            "razon_social": celdas[2],
            "domicilio": celdas[3],
            "tipo": celdas[4],
            "estatus": celdas[5],
            "cursos": numero(celdas[6]),
            "instructores": numero(celdas[7]),
        })
    return registros


async def consultar_rfc(rfc: str) -> Dict[str, Any]:
    """Busca un RFC en el registro de agentes capacitadores externos."""
    rfc = normalizar_rfc(rfc)
    if not RFC_VALIDO.match(rfc):
        return {"rfc": rfc, "encontrado": False, "registros": [], "rfc_invalido": True}
    try:
        async with httpx.AsyncClient(timeout=25, follow_redirects=True,
                                     headers={"User-Agent": "Mozilla/5.0 (AACES verificacion de agentes)"}) as c:
            inicio = (await c.get(BUSCADOR)).text
            datos = {k: _oculto(k, inicio) for k in ("__VIEWSTATE", "__VIEWSTATEGENERATOR", "__EVENTVALIDATION")}
            if not datos["__VIEWSTATE"]:
                raise StpsNoDisponible("La página de la STPS cambió (no trae __VIEWSTATE)")
            datos.update({
                "__EVENTTARGET": "", "__EVENTARGUMENT": "", "__LASTFOCUS": "",
                "__SCROLLPOSITIONX": "0", "__SCROLLPOSITIONY": "0",
                "ctl00$MainContent$tbRazonSocial": "", "ctl00$MainContent$tbRFC": rfc,
                "ctl00$MainContent$tbDomicilio": "", "ctl00$MainContent$tbFechaInicio": "",
                "ctl00$MainContent$tbFechaTermino": "", "ctl00$MainContent$ddlEntidadFederativa": "-1",
                "ctl00$MainContent$ddlMunicipio": "-1", "ctl00$MainContent$brnConsultar": "Consultar",
            })
            r = await c.post(BUSCADOR, data=datos, headers={"Referer": BUSCADOR, "Origin": ORIGEN})
    except httpx.HTTPError as e:
        raise StpsNoDisponible(f"No se pudo conectar con la STPS: {type(e).__name__}") from e
    if r.status_code != 200:
        raise StpsNoDisponible(f"La STPS respondió {r.status_code}")
    if "Resultado de la consulta" not in r.text and "No se encontraron" not in r.text and "repDatos" not in r.text:
        # Sin resultados la página vuelve al formulario; si no es ninguno de los dos, cambió
        if "tbRFC" not in r.text:
            raise StpsNoDisponible("La respuesta de la STPS no tiene el formato esperado")
    registros = _leer_resultados(r.text, rfc)
    return {"rfc": rfc, "encontrado": bool(registros), "registros": registros}


# ---------------------------------------------------------------------------
# Coincidencia de nombre
# ---------------------------------------------------------------------------
# Un RFC es público: cualquiera podría registrarse en AACES con el RFC de un agente
# que sí está registrado. Por eso solo validamos en automático si además la razón
# social coincide; si no, queda para revisión manual del admin.

_SUFIJOS = re.compile(
    r"\b(S\.?\s?A\.?\s?P\.?\s?I\.?|S\.?\s?A\.?\s?B\.?|S\.?\s?A\.?|S\.?\s?C\.?|A\.?\s?C\.?|S\.?\s?DE\s?R\.?\s?L\.?|"
    r"S\.?\s?A\.?\s?S\.?|DE\s?C\.?\s?V\.?|C\.?\s?V\.?|SOCIEDAD|CIVIL|ANONIMA|ASOCIACION|RESPONSABILIDAD|LIMITADA|CAPITAL|VARIABLE)\b"
)
_VACIAS = {"DE", "DEL", "LA", "LAS", "EL", "LOS", "Y", "E", "EN"}


def _palabras(nombre: str) -> set:
    import unicodedata
    t = unicodedata.normalize("NFD", (nombre or "").upper())
    t = "".join(ch for ch in t if unicodedata.category(ch) != "Mn")
    t = _SUFIJOS.sub(" ", t)
    t = re.sub(r"[^A-Z0-9 ]", " ", t)
    return {w for w in t.split() if w not in _VACIAS and len(w) > 1}


def nombres_coinciden(a: str, b: str) -> bool:
    pa, pb = _palabras(a), _palabras(b)
    if not pa or not pb:
        return False
    comunes = len(pa & pb)
    # Casi todas las palabras deben coincidir (ya sin sufijos como S.C. o S.A. de C.V.);
    # así "…Integral de Pachuca" no pasa por "…Integral de Toluca"
    return comunes / max(len(pa), len(pb)) >= 0.8


# ---------------------------------------------------------------------------
# Verificación de una organización
# ---------------------------------------------------------------------------

async def verificar_organizacion(db: AsyncSession, org_id: str, forzar: bool = False) -> Dict[str, Any]:
    org = (await db.execute(text("""
        SELECT rfc, stps_consultado_en, stps_origen, stps_validado, razon_social, nombre_comercial
        FROM aaces.organizaciones WHERE id = CAST(:o AS uuid)
    """), {"o": org_id})).fetchone()
    if not org:
        return {"estado": "sin_organizacion"}
    rfc, consultado, origen, validado = normalizar_rfc(descifrar(org[0])), org[1], org[2], bool(org[3])
    nombres_org = [n for n in (org[4], org[5]) if n]
    ahora = datetime.now(timezone.utc)
    if not forzar and consultado and ahora - consultado < timedelta(hours=12):
        return {"estado": "reciente", "consultado_en": consultado.isoformat()}

    try:
        res = await consultar_rfc(rfc)
    except StpsNoDisponible as e:
        # Un fallo de la STPS no cambia lo que ya sabíamos
        await db.execute(text("""
            INSERT INTO aaces.stps_consultas (organizacion_id, rfc, resultado, detalle)
            VALUES (CAST(:o AS uuid), :r, 'error', to_jsonb(CAST(:d AS text)))
        """), {"o": org_id, "r": cifrar(rfc), "d": str(e)[:500]})
        await db.commit()
        logger.warning("Verificación STPS de %s no disponible: %s", org_id, e)
        return {"estado": "no_disponible", "detalle": str(e)}

    activos = [x for x in res["registros"] if x["estatus"].lower() == "activo"]
    principal = (activos or res["registros"] or [None])[0]
    coincide = bool(principal) and any(nombres_coinciden(n, principal["razon_social"]) for n in nombres_org)
    if res.get("rfc_invalido"):
        resultado = "rfc_invalido"
    elif activos and not coincide:
        resultado = "nombre_distinto"  # el RFC existe pero con otro nombre: revisión manual
    elif activos:
        resultado = "activo"
    elif res["registros"]:
        resultado = "otro_estatus"
    else:
        resultado = "no_encontrado"

    await db.execute(text("""
        INSERT INTO aaces.stps_consultas (organizacion_id, rfc, resultado, detalle)
        VALUES (CAST(:o AS uuid), :r, :res, CAST(:d AS jsonb))
    """), {"o": org_id, "r": cifrar(rfc), "res": resultado, "d": json.dumps([{k: v for k, v in x.items() if k != "rfc"} for x in res["registros"]], ensure_ascii=False)})

    cambios: Dict[str, Any] = {
        "stps_consultado_en": ahora,
        "stps_estatus": ("Nombre distinto" if resultado == "nombre_distinto" else principal["estatus"]) if principal else resultado,
        "stps_razon_social": principal["razon_social"] if principal else None,
        "stps_cursos": principal["cursos"] if principal else None,
        "stps_instructores": principal["instructores"] if principal else None,
    }
    if resultado == "activo":
        cambios.update({"stps_validado": True, "stps_origen": origen if origen == "manual" else "automatica"})
        if not validado:
            cambios["stps_validado_en"] = ahora
    elif origen != "manual":
        # Solo retiramos lo que validamos en automático; lo que validaste a mano se respeta
        cambios.update({"stps_validado": False, "stps_validado_en": None, "stps_origen": None})

    sets = ", ".join(f"{k} = :{k}" for k in cambios)
    await db.execute(text(f"UPDATE aaces.organizaciones SET {sets} WHERE id = CAST(:o AS uuid)"), {**cambios, "o": org_id})
    await db.commit()
    return {"estado": resultado, "registros": res["registros"], "consultado_en": ahora.isoformat()}


async def estado_organizacion(db: AsyncSession, org_id: str) -> Dict[str, Any]:
    r = (await db.execute(text("""
        SELECT rfc, stps_validado, stps_validado_en, stps_origen, stps_estatus, stps_razon_social,
               stps_cursos, stps_instructores, stps_consultado_en
        FROM aaces.organizaciones WHERE id = CAST(:o AS uuid)
    """), {"o": org_id})).fetchone()
    if not r:
        return {}
    return {
        "rfc": descifrar(r[0]), "validado": bool(r[1]),
        "validado_en": r[2].isoformat() if r[2] else None,
        "origen": r[3], "estatus": r[4], "razon_social": r[5],
        "cursos": r[6], "instructores": r[7],
        "consultado_en": r[8].isoformat() if r[8] else None,
        "fuente": BUSCADOR,
    }


def verificar_en_segundo_plano(org_id: str, forzar: bool = True) -> None:
    """Para el registro: no hacemos esperar al usuario ni fallamos si la STPS no responde."""
    import asyncio

    async def _run():
        from app.core.database import AsyncSessionLocal
        async with AsyncSessionLocal() as s:
            try:
                await verificar_organizacion(s, org_id, forzar=forzar)
            except Exception:
                logger.exception("Verificación STPS en segundo plano falló (%s)", org_id)

    try:
        asyncio.get_running_loop().create_task(_run())
    except RuntimeError:
        pass


async def verificar_todas(db: AsyncSession, pausa_segundos: float = 3.0) -> Dict[str, int]:
    """Job semanal: re-verifica a todas las agencias con RFC, una por una y sin prisa."""
    import asyncio
    orgs = (await db.execute(text("""
        SELECT id FROM aaces.organizaciones WHERE COALESCE(rfc, '') <> '' AND estatus = 'activa'
        ORDER BY stps_consultado_en NULLS FIRST
    """))).fetchall()
    resumen: Dict[str, int] = {}
    for (org_id,) in orgs:
        r = await verificar_organizacion(db, str(org_id), forzar=True)
        resumen[r["estado"]] = resumen.get(r["estado"], 0) + 1
        if r["estado"] == "no_disponible":
            break  # si la STPS está caída no insistimos con las demás
        await asyncio.sleep(pausa_segundos)
    return resumen
