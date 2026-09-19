"""Tests Fase 2 — Multi-tenancy.

Contrato bajo prueba:
- Ninguna organización puede leer ni modificar recursos de otra.
- El ``cliente_id`` legacy NUNCA se deriva del ``sub`` del JWT.
- La plataforma no tiene organización propia: los endpoints de org le
  responden 403 explícito (nunca fallback a otra organización).
- Conocer un ID (curso, participante, documento) no concede acceso.
"""
import os
import uuid

os.environ["SECRET_KEY"] = "test-secret-key-fase2-no-produccion"
os.environ["DATABASE_URL"] = "postgresql+asyncpg://test:test@localhost:5432/test_no_usada"

import pytest
from fastapi import HTTPException

from app.core.identity import (
    Identity,
    get_current_cliente_id,
    require_org_id,
    require_org_identity,
)
from app.api.v1.endpoints.clientes import (
    _exigir_acceso_cliente,
    _exigir_cp_propio,
    _own_cliente_id,
)


# ------------------------------------------------------------------ doubles

class FakeResult:
    def __init__(self, row=None, scalar=None):
        self._row = row
        self._scalar = scalar

    def fetchone(self):
        return self._row

    def scalar(self):
        return self._scalar


class FakeDB:
    """Doble de AsyncSession que captura consulta y parámetros."""

    def __init__(self, row=None, scalar=None):
        self._row = row
        self._scalar = scalar
        self.last_query = None
        self.last_params = None

    async def execute(self, query, params=None):
        self.last_query = str(query)
        self.last_params = params or {}
        return FakeResult(self._row, self._scalar)


def ident(source="usuario", org_id=None, user_id=None, role="admin"):
    return Identity(
        user_id=str(user_id or uuid.uuid4()),
        source=source,
        role=role,
        email="u@test.com",
        org_id=str(org_id) if org_id else None,
    )


# ------------------------------------------------- get_current_cliente_id

@pytest.mark.asyncio
async def test_cliente_id_se_resuelve_por_organizacion_no_por_sub():
    org_id = uuid.uuid4()
    cliente_id = uuid.uuid4()
    user_id = uuid.uuid4()  # sub del JWT, distinto del cliente_id
    db = FakeDB(row=(cliente_id,))
    identity = ident(source="usuario", org_id=org_id, user_id=user_id)

    cid = await get_current_cliente_id(db, identity)

    assert cid == str(cliente_id)
    # El sub NUNCA debe viajar como parámetro de la consulta.
    assert str(user_id) not in db.last_params.values()
    assert db.last_params["org_id"] == str(org_id)
    assert "organizacion_id" in db.last_query


@pytest.mark.asyncio
async def test_cliente_id_legacy_usa_puente_organizacion():
    org_id = uuid.uuid4()
    cliente_id = uuid.uuid4()
    db = FakeDB(row=(org_id,))  # clientes.organizacion_id
    # get_current_cliente_id para source=cliente consulta organizacion_id...
    # y luego el cliente vinculado a esa org:
    db2 = FakeDB(row=(cliente_id,))
    identity = ident(source="cliente", user_id=uuid.uuid4())

    # Primera llamada: resuelve organizacion_id del cliente legacy.
    from app.core.identity import require_org_id
    org = await require_org_id(db, identity)
    assert org == str(org_id)

    identity_org = ident(source="cliente", org_id=org_id, user_id=identity.user_id)
    cid = await get_current_cliente_id(db2, identity_org)
    assert cid == str(cliente_id)


@pytest.mark.asyncio
async def test_cliente_id_plataforma_403_sin_fallback():
    db = FakeDB(row=(uuid.uuid4(),))
    identity = ident(source="plataforma")
    with pytest.raises(HTTPException) as exc:
        await get_current_cliente_id(db, identity)
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_cliente_id_sin_fila_vinculada_403():
    db = FakeDB(row=None)
    identity = ident(source="usuario", org_id=uuid.uuid4())
    with pytest.raises(HTTPException) as exc:
        await get_current_cliente_id(db, identity)
    assert exc.value.status_code == 403


# ---------------------------------------------------------- require_org_id

@pytest.mark.asyncio
async def test_require_org_id_usuario_devuelve_org_de_bd():
    org_id = uuid.uuid4()
    db = FakeDB()
    identity = ident(source="usuario", org_id=org_id)
    assert await require_org_id(db, identity) == str(org_id)


@pytest.mark.asyncio
async def test_require_org_id_plataforma_403():
    db = FakeDB()
    with pytest.raises(HTTPException) as exc:
        await require_org_id(db, ident(source="plataforma"))
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_require_org_identity_rechaza_plataforma_y_legacy():
    with pytest.raises(HTTPException) as exc:
        await require_org_identity(ident(source="plataforma"))
    assert exc.value.status_code == 403
    with pytest.raises(HTTPException) as exc:
        await require_org_identity(ident(source="cliente", org_id=uuid.uuid4()))
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_require_org_identity_acepta_usuario_con_org():
    org_id = uuid.uuid4()
    identity = ident(source="usuario", org_id=org_id)
    assert await require_org_identity(identity) is identity


# ------------------------------------------------------ gates de recursos

class FakeDBSeq(FakeDB):
    """Doble que devuelve una fila/escalar distinto por llamada."""

    def __init__(self, calls: list):
        super().__init__()
        self._calls = list(calls)
        self.queries = []

    async def execute(self, query, params=None):
        self.queries.append(str(query))
        self.last_query = str(query)
        self.last_params = params or {}
        row, scalar = self._calls.pop(0)
        return FakeResult(row, scalar)


@pytest.mark.asyncio
async def test_exigir_cp_propio_bloquea_cross_tenant():
    # 1ª llamada: puente -> cliente propio; 2ª: el JOIN no encuentra el registro
    # (es de otra organización o no existe).
    cliente_id = uuid.uuid4()
    db = FakeDBSeq([((cliente_id,), None), (None, None)])
    identity = ident(source="usuario", org_id=uuid.uuid4())
    with pytest.raises(HTTPException) as exc:
        await _exigir_cp_propio(db, identity, str(uuid.uuid4()))
    assert exc.value.status_code == 404
    # La consulta de propiedad cruza curso_participante -> cursos -> cliente_id propio.
    assert "c.cliente_id" in db.last_query
    assert db.last_params["cid"] == str(cliente_id)


@pytest.mark.asyncio
async def test_exigir_cp_propio_permite_recurso_propio():
    cliente_id = uuid.uuid4()
    db = FakeDBSeq([((cliente_id,), None), (None, 1)])
    identity = ident(source="usuario", org_id=uuid.uuid4())
    await _exigir_cp_propio(db, identity, str(uuid.uuid4()))  # no lanza


@pytest.mark.asyncio
async def test_exigir_cp_propio_plataforma_no_filtra():
    db = FakeDBSeq([])
    await _exigir_cp_propio(db, ident(source="plataforma"), str(uuid.uuid4()))
    assert db.queries == []  # plataforma: sin consulta de propiedad


def test_exigir_acceso_cliente_bloquea_otro_cliente():
    identity = ident(source="usuario", org_id=uuid.uuid4())
    with pytest.raises(HTTPException) as exc:
        _exigir_acceso_cliente(uuid.uuid4(), str(uuid.uuid4()), identity)
    assert exc.value.status_code == 403


def test_exigir_acceso_cliente_permite_propio_y_plataforma():
    identity = ident(source="usuario", org_id=uuid.uuid4())
    propio = uuid.uuid4()
    _exigir_acceso_cliente(propio, str(propio), identity)  # no lanza
    _exigir_acceso_cliente(uuid.uuid4(), None, ident(source="plataforma"))  # no lanza


@pytest.mark.asyncio
async def test_own_cliente_id_deterministico_y_por_org():
    org_id = uuid.uuid4()
    cliente_id = uuid.uuid4()
    db = FakeDB(row=(cliente_id,))
    identity = ident(source="usuario", org_id=org_id)
    assert await _own_cliente_id(db, identity) == str(cliente_id)
    assert "ORDER BY fecha_creacion" in db.last_query
    assert db.last_params["org_id"] == str(org_id)
