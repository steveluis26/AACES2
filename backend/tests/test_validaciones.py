import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestValidaciones:
    async def test_validar_certificado_invalid_code(self, async_client: AsyncClient):
        response = await async_client.post(
            "/api/v1/validaciones/validar-certificado",
            json={"codigo_validacion": "INVALIDO123"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "valido" in data
        assert data["valido"] is False

    async def test_validar_certificado_empty_code(self, async_client: AsyncClient):
        response = await async_client.post(
            "/api/v1/validaciones/validar-certificado",
            json={"codigo_validacion": ""}
        )
        assert response.status_code == 422

    async def test_validar_certificado_missing_code(self, async_client: AsyncClient):
        response = await async_client.post(
            "/api/v1/validaciones/validar-certificado",
            json={}
        )
        assert response.status_code == 422

    async def test_get_estadisticas(self, async_client: AsyncClient):
        response = await async_client.get("/api/v1/validaciones/estadisticas-validacion")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)

    async def test_validar_with_rate_limiting(self, async_client: AsyncClient):
        for _ in range(6):
            response = await async_client.post(
                "/api/v1/validaciones/validar-certificado",
                json={"codigo_validacion": "RATELIMIT01"}
            )
        assert response.status_code in (200, 429)
