import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

class TestAuthLogin:
    async def test_login_success(self, async_client: AsyncClient, test_user: dict):
        response = await async_client.post(
            "/api/v1/auth/login",
            json={"correo": test_user["correo"], "password": test_user["password"]}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    async def test_login_invalid_password(self, async_client: AsyncClient, test_user: dict):
        response = await async_client.post(
            "/api/v1/auth/login",
            json={"correo": test_user["correo"], "password": "WrongPass123!"}
        )
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data

    async def test_login_nonexistent_user(self, async_client: AsyncClient):
        response = await async_client.post(
            "/api/v1/auth/login",
            json={"correo": "noexiste@test.com", "password": "TestPass123!"}
        )
        assert response.status_code == 401

    async def test_login_empty_email(self, async_client: AsyncClient):
        response = await async_client.post(
            "/api/v1/auth/login",
            json={"correo": "", "password": "TestPass123!"}
        )
        assert response.status_code in (401, 422)

    async def test_login_missing_fields(self, async_client: AsyncClient):
        response = await async_client.post(
            "/api/v1/auth/login",
            json={}
        )
        assert response.status_code == 422


class TestAuthMe:
    async def test_get_me_success(self, async_client: AsyncClient, auth_headers: dict):
        response = await async_client.get("/api/v1/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "correo" in data
        assert "nombre" in data
        assert "categoria" in data

    async def test_get_me_no_token(self, async_client: AsyncClient):
        response = await async_client.get("/api/v1/auth/me")
        assert response.status_code == 403

    async def test_get_me_invalid_token(self, async_client: AsyncClient):
        response = await async_client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer invalid_token_here"}
        )
        assert response.status_code == 401


class TestAuthRefresh:
    async def test_refresh_success(self, async_client: AsyncClient, test_user: dict):
        login_resp = await async_client.post(
            "/api/v1/auth/login",
            json={"correo": test_user["correo"], "password": test_user["password"]}
        )
        refresh_token = login_resp.json()["refresh_token"]
        response = await async_client.post(
            "/api/v1/auth/refresh",
            headers={"Authorization": f"Bearer {refresh_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data

    async def test_refresh_with_access_token(self, async_client: AsyncClient, auth_headers: dict):
        access_token = auth_headers["Authorization"].replace("Bearer ", "")
        response = await async_client.post(
            "/api/v1/auth/refresh",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        assert response.status_code == 401

    async def test_refresh_no_token(self, async_client: AsyncClient):
        response = await async_client.post("/api/v1/auth/refresh")
        assert response.status_code == 403


class TestAuthLogout:
    async def test_logout_success(self, async_client: AsyncClient, auth_headers: dict):
        response = await async_client.post("/api/v1/auth/logout", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["message"] == "Sesión cerrada exitosamente"

    async def test_logout_no_token(self, async_client: AsyncClient):
        response = await async_client.post("/api/v1/auth/logout")
        assert response.status_code == 403
