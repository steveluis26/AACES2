import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestClientesCRUD:
    async def test_create_cliente(self, async_client: AsyncClient):
        response = await async_client.post(
            "/api/v1/clientes/clientes",
            json={
                "nombre": "Nuevo Cliente",
                "correo": f"nuevo_{id(self)}@test.com",
                "password": "SecurePass1!",
                "ciudad_base": "Quito"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["nombre"] == "Nuevo Cliente"

    async def test_create_cliente_duplicate_email(self, async_client: AsyncClient, test_user: dict):
        response = await async_client.post(
            "/api/v1/clientes/clientes",
            json={
                "nombre": "Duplicado",
                "correo": test_user["correo"],
                "password": "SecurePass1!"
            }
        )
        assert response.status_code in (400, 409)

    async def test_list_clientes(self, async_client: AsyncClient, auth_headers: dict):
        response = await async_client.get(
            "/api/v1/clientes/clientes",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, (list, dict))

    async def test_get_cliente_by_id(self, async_client: AsyncClient, test_user: dict, auth_headers: dict):
        response = await async_client.get(
            f"/api/v1/clientes/clientes/{test_user['id']}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_user["id"]

    async def test_get_cliente_unauthorized(self, async_client: AsyncClient):
        response = await async_client.get("/api/v1/clientes/clientes")
        assert response.status_code in (401, 403)


class TestCursos:
    async def test_create_curso(self, async_client: AsyncClient, test_user: dict, auth_headers: dict):
        response = await async_client.post(
            "/api/v1/clientes/cursos",
            headers=auth_headers,
            json={
                "nombre": "Curso de Prueba",
                "ciudad": "Quito",
                "fecha_inicio": "2025-01-15",
                "fecha_fin": "2025-02-15",
                "duracion_horas": 40,
                "modalidad": "presencial"
            }
        )
        assert response.status_code in (200, 201)
        if response.status_code == 200:
            data = response.json()
            assert "id" in data or data.get("nombre") == "Curso de Prueba"

    async def test_create_curso_missing_fields(self, async_client: AsyncClient, auth_headers: dict):
        response = await async_client.post(
            "/api/v1/clientes/cursos",
            headers=auth_headers,
            json={"nombre": "Curso Incompleto"}
        )
        assert response.status_code == 422
