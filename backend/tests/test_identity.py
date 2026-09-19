"""Tests Fase 1 — Identidad.

Contrato bajo prueba:
- ``sub`` del JWT es SIEMPRE el ID del usuario (nunca org_id ni cliente_id).
- ``org_id`` viaja en el access token de login Y de refresh.
- La organización se resuelve desde la BD, no del claim.
- ``get_current_cliente_id`` resuelve el cliente legacy por
  ``clientes.organizacion_id``, nunca a partir del ``sub``.
"""

import os
import uuid
from types import SimpleNamespace

os.environ["SECRET_KEY"] = "test-secret-key-fase1-no-produccion"
os.environ["DATABASE_URL"] = "postgresql+asyncpg://u:p@localhost:5432/aaces_test"

import pytest
from fastapi import HTTPException
from jose import jwt

from app.core.config import settings
from app.services.auth import auth_service, Role
from app.api.v1.endpoints.auth import _build_access_token_claims
from app.core.identity import (
    Identity,
    get_current_identity,
    get_current_cliente_id,
)


# ---------------------------------------------------------------- helpers

def make_user(rol="admin", organizacion_id=None, correo="u@test.com"):
    return SimpleNamespace(
        id=uuid.uuid4(),
        correo=correo,
        nombre="Usuario Test",
        rol=rol,
        organizacion_id=organizacion_id,
        activo=True,
    )


def make_credentials(token: str):
    return SimpleNamespace(credentials=token)


class FakeResult:
    def __init__(self, row):
        self._row = row

    def fetchone(self):
        return self._row


class FakeDB:
    """Doble de AsyncSession que captura la consulta ejecutada."""

    def __init__(self, row):
        self._row = row
        self.last_query = None
        self.last_params = None

    async def execute(self, query, params=None):
        self.last_query = str(query)
        self.last_params = params or {}
        return FakeResult(self._row)


# ---------------------------------------------------------------- claims

def test_claims_sub_es_user_id_y_org_id_presente():
    org_id = uuid.uuid4()
    user = make_user(rol="admin", organizacion_id=org_id)
    claims = _build_access_token_claims(user, "usuario")

    assert claims["sub"] == str(user.id)
    assert claims["sub"] != str(org_id)
    assert claims["org_id"] == str(org_id)
    assert claims["source"] == "usuario"
    assert claims["role"] == "admin"


def test_claims_plataforma_sin_org_id():
    user = make_user(rol="super_admin")
    claims = _build_access_token_claims(user, "plataforma")

    assert claims["sub"] == str(user.id)
    assert "org_id" not in claims
    assert claims["role"] == Role.ADMIN


def test_claims_staff_no_revienta_y_usa_cliente():
    # Regresión: Role.CLIENT no existía y el login de staff tronaba con
    # AttributeError. Debe mapear a Role.CLIENTE.
    user = make_user(rol="staff", organizacion_id=uuid.uuid4())
    claims = _build_access_token_claims(user, "usuario")
    assert claims["role"] == Role.CLIENTE


def test_access_token_exige_source():
    with pytest.raises(ValueError):
        auth_service.create_access_token(data={"sub": str(uuid.uuid4())})


def test_decode_token_rechaza_sin_source():
    raw = jwt.encode({"sub": str(uuid.uuid4())}, settings.SECRET_KEY, algorithm="HS256")
    assert auth_service.decode_token(raw) is None


def test_token_redondo_conserva_claims():
    user = make_user(rol="admin", organizacion_id=uuid.uuid4())
    token = auth_service.create_access_token(data=_build_access_token_claims(user, "usuario"))
    payload = auth_service.decode_token(token)

    assert payload is not None
    assert payload["sub"] == str(user.id)
    assert payload["org_id"] == str(user.organizacion_id)
    assert payload["source"] == "usuario"
    assert payload["type"] == "access"


def test_refresh_reconstruye_claims_con_org_id():
    # El bug: el refresh construía el token a mano y perdía org_id.
    # Ambos flujos deben usar el mismo constructor de claims.
    user = make_user(rol="staff", organizacion_id=uuid.uuid4())
    claims_login = _build_access_token_claims(user, "usuario")
    claims_refresh = _build_access_token_claims(user, "usuario")
    assert claims_login == claims_refresh
    assert "org_id" in claims_refresh


# ---------------------------------------------------------------- dependencia de identidad

@pytest.mark.asyncio
async def test_identity_resuelve_org_desde_bd(monkeypatch):
    org_id = uuid.uuid4()
    user = make_user(rol="admin", organizacion_id=org_id)
    token = auth_service.create_access_token(data=_build_access_token_claims(user, "usuario"))

    async def fake_get_user_by_id(db, user_id, source):
        assert str(user_id) == str(user.id)
        assert source == "usuario"
        return user

    monkeypatch.setattr(auth_service, "get_user_by_id", fake_get_user_by_id)

    identity = await get_current_identity(credentials=make_credentials(token), db=object())

    assert isinstance(identity, Identity)
    assert identity.user_id == str(user.id)
    assert identity.org_id == str(org_id)
    assert identity.source == "usuario"


@pytest.mark.asyncio
async def test_identity_no_confia_en_org_id_del_claim(monkeypatch):
    # Aunque el token traiga un org_id manipulado, la identidad usa la BD.
    org_real = uuid.uuid4()
    org_falso = uuid.uuid4()
    user = make_user(rol="admin", organizacion_id=org_real)
    claims = _build_access_token_claims(user, "usuario")
    claims["org_id"] = str(org_falso)  # claim manipulado
    token = auth_service.create_access_token(data=claims)

    async def fake_get_user_by_id(db, user_id, source):
        return user

    monkeypatch.setattr(auth_service, "get_user_by_id", fake_get_user_by_id)

    identity = await get_current_identity(credentials=make_credentials(token), db=object())
    assert identity.org_id == str(org_real)


@pytest.mark.asyncio
async def test_identity_rechaza_token_sin_source():
    raw = jwt.encode({"sub": str(uuid.uuid4())}, settings.SECRET_KEY, algorithm="HS256")
    with pytest.raises(HTTPException) as exc:
        await get_current_identity(credentials=make_credentials(raw), db=object())
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_identity_rechaza_sub_no_uuid(monkeypatch):
    claims = {"sub": "no-es-un-uuid", "source": "usuario", "role": "admin"}
    token = auth_service.create_access_token(data=claims)
    with pytest.raises(HTTPException) as exc:
        await get_current_identity(credentials=make_credentials(token), db=object())
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_identity_rechaza_usuario_inexistente(monkeypatch):
    user = make_user(rol="admin", organizacion_id=uuid.uuid4())
    token = auth_service.create_access_token(data=_build_access_token_claims(user, "usuario"))

    async def fake_get_user_by_id(db, user_id, source):
        return None

    monkeypatch.setattr(auth_service, "get_user_by_id", fake_get_user_by_id)
    with pytest.raises(HTTPException) as exc:
        await get_current_identity(credentials=make_credentials(token), db=object())
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_identity_plataforma_sin_org():
    user = make_user(rol="super_admin")
    token = auth_service.create_access_token(data=_build_access_token_claims(user, "plataforma"))

    async def fake_get_user_by_id(db, user_id, source):
        return user

    import app.core.identity as identity_mod
    orig = auth_service.get_user_by_id
    auth_service.get_user_by_id = fake_get_user_by_id
    try:
        identity = await get_current_identity(credentials=make_credentials(token), db=object())
    finally:
        auth_service.get_user_by_id = orig

    assert identity.org_id is None
    assert identity.source == "plataforma"


# ---------------------------------------------------------------- puente legacy cliente_id

@pytest.mark.asyncio
async def test_cliente_id_se_resuelve_por_organizacion_no_por_sub():
    org_id = uuid.uuid4()
    cliente_id = uuid.uuid4()
    user_id = uuid.uuid4()
    assert str(cliente_id) != str(user_id)  # el caso que rompía todo

    identity = Identity(
        user_id=str(user_id), source="usuario", role="admin",
        email="u@test.com", org_id=str(org_id),
    )
    db = FakeDB(row=(cliente_id,))

    resolved = await get_current_cliente_id(identity=identity, db=db)

    assert resolved == str(cliente_id)
    assert "organizacion_id" in db.last_query
    assert db.last_params["org_id"] == str(org_id)
    # El sub (user_id) jamás debe usarse para buscar el cliente
    assert str(user_id) not in db.last_query
    assert db.last_params.get("org_id") != str(user_id)


@pytest.mark.asyncio
async def test_cliente_id_sin_fila_asociada_da_403():
    identity = Identity(
        user_id=str(uuid.uuid4()), source="usuario", role="admin",
        email="u@test.com", org_id=str(uuid.uuid4()),
    )
    db = FakeDB(row=None)
    with pytest.raises(HTTPException) as exc:
        await get_current_cliente_id(identity=identity, db=db)
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_cliente_id_rechaza_plataforma():
    identity = Identity(
        user_id=str(uuid.uuid4()), source="plataforma", role="admin",
        email="a@test.com", org_id=None,
    )
    with pytest.raises(HTTPException) as exc:
        await get_current_cliente_id(identity=identity, db=FakeDB(row=None))
    assert exc.value.status_code == 403
