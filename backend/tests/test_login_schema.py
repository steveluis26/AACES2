"""Tests de regresión — contrato login vs registro.

Bug real (2026-09-19): el registro aceptaba cualquier texto con `@` pero
``LoginRequest.correo`` usaba ``EmailStr``, que rechaza dominios reservados
como ``.local``. Resultado: una cuenta recién registrada no podía hacer login
(422 antes de autenticar) y el frontend mostraba "[object Object]".

Contrato: todo correo aceptado por el registro debe ser aceptado por el
esquema del login. El login solo busca una cuenta existente; la validación
estricta de formato pertenece al registro, no al login.
"""

import pytest
from pydantic import ValidationError

from app.schemas import LoginRequest


class TestLoginRequestAceptaCorreosRegistrados:
    def test_correo_local_reservado(self):
        # demo-walkthrough@aaces.local: el registro lo aceptó, el login no.
        req = LoginRequest(correo="demo-walkthrough@aaces.local", password="AlgunaClave123")
        assert req.correo == "demo-walkthrough@aaces.local"

    def test_correo_normal_sigue_funcionando(self):
        req = LoginRequest(correo="admin@empresa.com", password="AlgunaClave123")
        assert req.correo == "admin@empresa.com"

    def test_password_vacia_sigue_rechazada(self):
        with pytest.raises(ValidationError):
            LoginRequest(correo="admin@empresa.com", password="")
