"""Tests del sistema de recordatorios.

Contrato bajo prueba:
- Cada aviso tiene clave determinística (tipo:referencia:variante).
- El job es idempotente: si la clave ya existe, no se reenvía.
- Los 5 eventos generan avisos solo para sus ventanas de días (30/15/7, 7/3/1,
  7, inmediato, <=7 sin inscritos).
- Los avisos van al admin de la organización, nunca al participante directo.
- Sin SMTP configurado el aviso se registra como 'omitido', no como fallido.
"""
import os
from datetime import date

os.environ["SECRET_KEY"] = "test-secret-key-recordatorios-no-produccion"
os.environ["DATABASE_URL"] = "postgresql+asyncpg://test:test@localhost:5433/test"

import pytest

from app.services import recordatorios as rec


# ------------------------------------------------------------------ doubles

class FakeMappings:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class FakeResult:
    def __init__(self, rows=None, row=None):
        self._rows = rows or []
        self._row = row

    def mappings(self):
        return FakeMappings(self._rows)

    def fetchall(self):
        return self._rows

    def fetchone(self):
        return self._row


class FakeDB:
    """Doble de AsyncSession con respuestas programables por script."""

    def __init__(self, script):
        # script: lista de FakeResult que se devuelven en orden por cada execute
        self._script = list(script)
        self.executed = []
        self.committed = 0

    async def execute(self, query, params=None):
        self.executed.append((str(query), params))
        if not self._script:
            raise AssertionError("FakeDB sin respuestas programadas")
        return self._script.pop(0)

    async def commit(self):
        self.committed += 1

    async def rollback(self):
        pass


def fila(**kw):
    """Fila falsa que soporta r['col'] y r.col como el RowMapping real."""
    class Fila(dict):
        def __getattr__(self, name):
            try:
                return self[name]
            except KeyError:
                raise AttributeError(name)
    return Fila(kw)


REF = date(2026, 9, 19)


# ------------------------------------------------------------------ pureza

def test_hoy_es_date():
    assert isinstance(rec.hoy(), date)


def test_nombre_completo():
    assert rec.nombre_completo(fila(nombre="María", apellido_paterno="García", apellido_materno="López")) == "María García López"
    assert rec.nombre_completo(fila(nombre="Juan", apellido_paterno=None, apellido_materno=None)) == "Juan"
    assert rec.nombre_completo(fila(nombre="", apellido_paterno=None, apellido_materno=None)) == "Participante"


# ------------------------------------------------------------------ colectores

@pytest.mark.asyncio
async def test_constancias_por_vencer_solo_ventanas():
    db = FakeDB([
        FakeResult(rows=[
            fila(cp_id="cp1", fecha_expiracion=date(2026, 10, 19), folio="CERT-A",
                 nombre="Ana", apellido_paterno="P", apellido_materno=None,
                 p_correo="ana@x.com", p_telefono=None,
                 curso_nombre="Alturas", codigo_curso="CUR-1", org_id="org1"),
            fila(cp_id="cp2", fecha_expiracion=date(2026, 10, 4), folio="CERT-B",
                 nombre="Luis", apellido_paterno=None, apellido_materno=None,
                 p_correo=None, p_telefono="555", curso_nombre="Alturas",
                 codigo_curso="CUR-1", org_id="org1"),
            # fuera de ventana (20 días): debe ignorarse
            fila(cp_id="cp3", fecha_expiracion=date(2026, 10, 9), folio="CERT-C",
                 nombre="Eva", apellido_paterno=None, apellido_materno=None,
                 p_correo=None, p_telefono=None, curso_nombre="Alturas",
                 codigo_curso="CUR-1", org_id="org1"),
        ])
    ])
    avisos = await rec.constancias_por_vencer(db, REF)
    claves = {a["clave"] for a in avisos}
    assert claves == {"constancia_por_vencer:cp1:30", "constancia_por_vencer:cp2:15"}
    # el aviso es para el admin de la org, con datos del participante
    a30 = next(a for a in avisos if a["dias_restantes"] == 30)
    assert a30["organizacion_id"] == "org1"
    assert "ana@x.com" in a30["mensaje"]
    assert a30["referencia_tipo"] == "curso_participante"


@pytest.mark.asyncio
async def test_cursos_proximos_y_sin_participantes():
    db = FakeDB([
        FakeResult(rows=[
            fila(curso_id="c1", curso_nombre="Alturas", codigo_curso="CUR-1",
                 fecha_inicio=date(2026, 9, 26), ciudad="GDL", org_id="org1", inscritos=5),
            fila(curso_id="c2", curso_nombre="Viejos", codigo_curso="CUR-2",
                 fecha_inicio=date(2026, 9, 22), ciudad="GDL", org_id="org1", inscritos=2),
        ])
    ])
    avisos = await rec.cursos_proximos(db, REF)
    assert {a["clave"] for a in avisos} == {"curso_proximo:c1:7", "curso_proximo:c2:3"}
    assert all(a["tipo"] == "curso_proximo" for a in avisos)

    db2 = FakeDB([
        FakeResult(rows=[
            fila(curso_id="c9", curso_nombre="Vacío", codigo_curso="CUR-9",
                 fecha_inicio=date(2026, 9, 22), ciudad="CDMX", org_id="org1"),
        ])
    ])
    avisos2 = await rec.cursos_sin_participantes(db2, REF)
    assert len(avisos2) == 1
    assert avisos2[0]["clave"] == "curso_sin_participantes:c9"
    assert avisos2[0]["tipo"] == "curso_sin_participantes"


@pytest.mark.asyncio
async def test_suscripciones_por_vencer():
    db = FakeDB([
        FakeResult(rows=[
            fila(sub_id="s1", fecha_fin=date(2026, 9, 26), org_id="org1", plan_nombre="Pro"),
        ])
    ])
    avisos = await rec.suscripciones_por_vencer(db, REF)
    assert len(avisos) == 1
    a = avisos[0]
    assert a["clave"] == "suscripcion_por_vencer:s1:7"
    assert a["dias_restantes"] == 7
    # la query pide exactamente fecha = hoy+7
    _, params = db.executed[0]
    assert params["fecha"] == date(2026, 9, 26)


# ------------------------------------------------------------------ idempotencia y envío

@pytest.mark.asyncio
async def test_job_idempotente_no_reenvia(monkeypatch):
    # _registrar_aviso devuelve None = la clave ya existía
    async def fake_registrar(db, aviso):
        return None

    monkeypatch.setattr(rec, "_registrar_aviso", fake_registrar)
    monkeypatch.setattr(rec, "correos_admin_org", lambda db, org: _admins())

    async def _admins():
        return ["admin@org1.com"]
    enviados = []

    async def fake_enviar(dest, asunto, mensaje):
        enviados.append(dest)
        return True, None

    monkeypatch.setattr(rec, "_enviar_correo", fake_enviar)

    db = FakeDB([
        FakeResult(rows=[]),  # constancias
        FakeResult(rows=[]),  # cursos próximos
        FakeResult(rows=[]),  # suscripciones
        FakeResult(rows=[]),  # sin participantes
    ])

    # un aviso manual para forzar el camino de "ya existía"
    async def un_colector(db, ref):
        return [{"organizacion_id": "org1", "tipo": "curso_proximo",
                 "clave": "curso_proximo:c1:7", "titulo": "t", "mensaje": "m",
                 "asunto": "a", "referencia_tipo": "curso",
                 "referencia_id": "c1", "dias_restantes": 7}]

    monkeypatch.setattr(rec, "cursos_proximos", un_colector)
    resumen = await rec.ejecutar_recordatorios(db, REF)
    assert resumen == {"generados": 0, "enviados": 0, "fallidos": 0, "omitidos": 0}
    assert enviados == []


@pytest.mark.asyncio
async def test_job_genera_y_envia(monkeypatch):
    async def fake_registrar(db, aviso):
        return "nid-1"

    monkeypatch.setattr(rec, "_registrar_aviso", fake_registrar)

    async def fake_enviar(dest, asunto, mensaje):
        assert dest == "admin@org1.com"
        return True, None

    monkeypatch.setattr(rec, "_enviar_correo", fake_enviar)

    async def fake_admins(db, org):
        return ["admin@org1.com"]

    monkeypatch.setattr(rec, "correos_admin_org", fake_admins)

    async def un_colector(db, ref):
        return [{"organizacion_id": "org1", "tipo": "suscripcion_por_vencer",
                 "clave": "suscripcion_por_vencer:s1:7", "titulo": "t", "mensaje": "m",
                 "asunto": "a", "referencia_tipo": "suscripcion",
                 "referencia_id": "s1", "dias_restantes": 7}]

    async def vacio(db, ref):
        return []

    monkeypatch.setattr(rec, "constancias_por_vencer", vacio)
    monkeypatch.setattr(rec, "cursos_proximos", vacio)
    monkeypatch.setattr(rec, "suscripciones_por_vencer", un_colector)
    monkeypatch.setattr(rec, "cursos_sin_participantes", vacio)

    db = FakeDB([FakeResult(row=None)])  # UPDATE email_estado
    resumen = await rec.ejecutar_recordatorios(db, REF)
    assert resumen["generados"] == 1
    assert resumen["enviados"] == 1
    assert db.committed == 1


@pytest.mark.asyncio
async def test_sin_smtp_se_marca_omitido(monkeypatch):
    monkeypatch.setattr(rec, "_smtp_configurado", lambda: False)
    ok, error = await rec._enviar_correo("a@b.com", "asunto", "mensaje")
    assert ok is False
    assert error == "SMTP no configurado en el servidor"


@pytest.mark.asyncio
async def test_pago_fallido_genera_aviso_inmediato(monkeypatch):
    async def fake_registrar(db, aviso):
        assert aviso["tipo"] == "pago_fallido"
        assert aviso["clave"].startswith("pago_fallido:")
        return "nid-9"

    async def fake_enviar(dest, asunto, mensaje):
        return True, None

    async def fake_admins(db, org):
        return ["admin@org1.com"]

    monkeypatch.setattr(rec, "_registrar_aviso", fake_registrar)
    monkeypatch.setattr(rec, "_enviar_correo", fake_enviar)
    monkeypatch.setattr(rec, "correos_admin_org", fake_admins)

    db = FakeDB([FakeResult(row=None)])
    nid = await rec.registrar_pago_fallido(db, "org1", "tarjeta rechazada", referencia_id="pay-1")
    assert nid == "nid-9"
    assert db.committed == 1


@pytest.mark.asyncio
async def test_correos_admin_org_fallback_a_contacto():
    # sin usuarios admin: usa email_contacto de la organización
    db = FakeDB([
        FakeResult(rows=[]),
        FakeResult(row=("contacto@org.com",)),
    ])
    correos = await rec.correos_admin_org(db, "org1")
    assert correos == ["contacto@org.com"]


@pytest.mark.asyncio
async def test_job_colector_fallido_no_tumba_a_los_demas(monkeypatch):
    # Regresión: un colector con error de BD (ej. columna inexistente) no debe
    # impedir que los demás colectores generen sus avisos.
    async def colector_roto(db, ref):
        raise RuntimeError("column cp.folio does not exist")

    async def colector_ok(db, ref):
        return [{"organizacion_id": "org1", "tipo": "curso_proximo",
                 "clave": "curso_proximo:c1:7", "titulo": "t", "mensaje": "m",
                 "asunto": "a", "referencia_tipo": "curso",
                 "referencia_id": "c1", "dias_restantes": 7}]

    async def vacio(db, ref):
        return []

    monkeypatch.setattr(rec, "constancias_por_vencer", colector_roto)
    monkeypatch.setattr(rec, "cursos_proximos", colector_ok)
    monkeypatch.setattr(rec, "suscripciones_por_vencer", vacio)
    monkeypatch.setattr(rec, "cursos_sin_participantes", vacio)
    monkeypatch.setattr(rec, "_registrar_aviso", lambda db, aviso: _nid("nid-x"))
    monkeypatch.setattr(rec, "_enviar_correo", lambda d, a, m: _ok())
    monkeypatch.setattr(rec, "correos_admin_org", lambda db, org: _admins2())

    async def _nid(x):
        return x

    async def _ok():
        return False, "SMTP no configurado en el servidor"

    async def _admins2():
        return ["admin@org1.com"]

    db = FakeDB([FakeResult(row=None)])  # UPDATE email_estado
    resumen = await rec.ejecutar_recordatorios(db, REF)
    assert resumen["generados"] == 1
    assert resumen["omitidos"] == 1


@pytest.mark.asyncio
async def test_constancias_usa_id_certificado():
    # La columna real es id_certificado (no folio)
    db = FakeDB([FakeResult(rows=[])])
    await rec.constancias_por_vencer(db, REF)
    sql, _ = db.executed[0]
    assert "cp.id_certificado AS folio" in sql
    assert "cp.folio" not in sql
