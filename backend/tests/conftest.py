import asyncio
import os
import uuid
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text

os.environ["DEBUG"] = "true"
os.environ["ALLOW_DEV_LOGIN"] = "true"
os.environ["DATABASE_URL"] = "postgresql+asyncpg://aaces_user:aaces_password@localhost:5433/aaces_test"
os.environ["SECRET_KEY"] = "test-secret-key-not-for-production"
os.environ["ENCRYPTION_KEY"] = "test-encryption-key-32-bytes-long!!"

from app.core.config import settings
from app.core.database import Base, get_db, engine as live_engine
from app.main import app
from app.services.auth import auth_service, Role
from app.services.security import security_service

TEST_DB_URL = "postgresql+asyncpg://aaces_user:aaces_password@localhost:5433/aaces_test"

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()

@pytest_asyncio.fixture(scope="session")
async def test_engine():
    engine = create_async_engine(TEST_DB_URL, echo=True)
    async with engine.begin() as conn:
        await conn.execute(text("CREATE SCHEMA IF NOT EXISTS aaces"))
        await conn.execute(text("SET search_path TO aaces"))
        for extension in ["pgcrypto", "uuid-ossp"]:
            try:
                await conn.execute(text(f"CREATE EXTENSION IF NOT EXISTS \"{extension}\""))
            except Exception:
                pass
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()

@pytest_asyncio.fixture
async def db_session(test_engine):
    TestSessionLocal = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with TestSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

@pytest_asyncio.fixture
async def test_app(db_session):
    async def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db
    yield app
    app.dependency_overrides.clear()

@pytest_asyncio.fixture
async def async_client(test_app):
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

@pytest_asyncio.fixture
async def test_user(db_session):
    user_id = str(uuid.uuid4())
    password = "TestPass123!"
    pw_hash = security_service.hash_password(password)
    await db_session.execute(
        text("""
            INSERT INTO aaces.clientes (id, nombre, correo, password_hash, categoria, estado, acepta_terminos)
            VALUES (:id, :nombre, :correo, :pw_hash, 'basico', 'activo', true)
        """),
        {"id": user_id, "nombre": "Test User", "correo": f"test_{uuid.uuid4().hex[:8]}@test.com", "pw_hash": pw_hash}
    )
    await db_session.commit()
    return {"id": user_id, "password": password}

@pytest_asyncio.fixture
async def auth_headers(async_client, test_user):
    response = await async_client.post(
        "/api/v1/auth/login",
        json={"correo": test_user["correo"], "password": test_user["password"]}
    )
    data = response.json()
    token = data.get("access_token") or data.get("token")
    return {"Authorization": f"Bearer {token}"}

@pytest_asyncio.fixture
async def admin_user(db_session):
    user_id = str(uuid.uuid4())
    password = "AdminPass123!"
    pw_hash = security_service.hash_password(password)
    await db_session.execute(
        text("""
            INSERT INTO aaces.clientes (id, nombre, correo, password_hash, categoria, estado, acepta_terminos)
            VALUES (:id, :nombre, :correo, :pw_hash, 'enterprise', 'activo', true)
        """),
        {"id": user_id, "nombre": "Admin User", "correo": "admin@aaces.com", "pw_hash": pw_hash}
    )
    await db_session.commit()
    return {"id": user_id, "password": password}
