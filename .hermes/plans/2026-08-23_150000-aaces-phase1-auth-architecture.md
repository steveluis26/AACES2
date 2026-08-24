# AACES Phase 1 — Arquitectura de Autenticación Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Implementar la arquitectura de autenticación correcta con separación estructural entre `usuarios_plataforma` (visión transversal, sin organización) y `usuarios` (pertenecen a exactamente una organización), sin tocar tablas legacy.

**Architecture:** FastAPI + PostgreSQL + SQLAlchemy 2.0 async. El esquema se aplica via `ensure_schema()` durante startup (CREATE TABLE IF NOT EXISTS + ALTER TABLE). No hay Alembic. Seed idempotente corre en cada arranque.

**Tech Stack:** Python 3.11, FastAPI, SQLAlchemy 2.0 (asyncpg), Pydantic v2, PostgreSQL 15, Render (Docker)

---

## Current Context

- **BD actual**: Esquema `aaces` con tablas `usuarios`, `organizaciones`, `clientes`, `administradores`, `super_administradores` + 18 FKs hacia `clientes`/`usuarios`
- **Auth actual**: `/auth/login` → JWT con `source: "usuario"` → `/auth/me` → `ClienteResponse` (200 OK estable)
- **Datos**: 100% DEMO (admin@aaces.com, org demo, cursos demo, etc.) — **no preservar**
- **UUID actual**: `113ab7d4-505d-4bdd-b4ab-c5c0a0c12792` — **descartar, generar nuevos**
- **Legacy**: `clientes`, `administradores`, `super_administradores` — **NO TOCAR en Fase 1**

---

## Final Schema (Post-Fase 1)

### Nueva tabla: `usuarios_plataforma`

```sql
CREATE TABLE IF NOT EXISTS aaces.usuarios_plataforma (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    correo VARCHAR(255) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(30) DEFAULT 'super_admin' NOT NULL,
    activo BOOLEAN DEFAULT true NOT NULL,
    fecha_creacion TIMESTAMPTZ DEFAULT now() NOT NULL,
    fecha_actualizacion TIMESTAMPTZ DEFAULT now() NOT NULL,
    -- NO organizacion_id
    CONSTRAINT check_rol_plataforma CHECK (rol IN ('super_admin'))
);
CREATE INDEX IF NOT EXISTS idx_usuarios_plataforma_correo ON aaces.usuarios_plataforma(correo);
```

### Tabla `usuarios` — MODIFICADA

```sql
-- Cambios incrementales sobre tabla existente:
ALTER TABLE aaces.usuarios
    ALTER COLUMN organizacion_id SET NOT NULL,          -- era nullable, ahora obligatorio
    DROP COLUMN IF EXISTS administrador_id,             -- si existe (legacy)
    ADD CONSTRAINT check_rol_usuario CHECK (rol IN ('admin', 'staff')),
    ADD CONSTRAINT fk_usuarios_organizacion FOREIGN KEY (organizacion_id)
        REFERENCES aaces.organizaciones(id) ON DELETE CASCADE;
-- UNIQUE (organizacion_id, correo) ya existe
```

### Tablas NO modificadas en Fase 1

| Tabla | Acción |
|-------|--------|
| `organizaciones` | Sin cambios |
| `clientes` | **NO TOCAR** (18 FKs entrantes) |
| `administradores` | **NO TOCAR** |
| `super_administradores` | **NO TOCAR** |
| Otras tablas negocio | Sin cambios |

---

## Detectar Esquema Actual / Idempotencia de Migración

Como no hay Alembic, `ensure_schema()` debe ser **idempotente y auto-detectable**:

```python
# En bootstrap/schema.py — cada CREATE/ALTER usa IF NOT EXISTS / verifica existencia
async def create_usuarios_plataforma(conn: AsyncConnection) -> None:
    # 1. Verificar si tabla ya existe
    result = await conn.execute(text("""
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'aaces' AND table_name = 'usuarios_plataforma'
    """))
    if result.scalar():
        logger.info("usuarios_plataforma ya existe, saltando creación")
        return
    
    # 2. Crear tabla
    await conn.execute(text("""
        CREATE TABLE aaces.usuarios_plataforma (...)
    """))
    await conn.execute(text("CREATE INDEX ..."))
    logger.info("usuarios_plataforma creada")

async def alter_usuarios_add_constraints(conn: AsyncConnection) -> None:
    # Verificar constraint NOT NULL en organizacion_id
    result = await conn.execute(text("""
        SELECT is_nullable FROM information_schema.columns
        WHERE table_schema = 'aaces' AND table_name = 'usuarios' AND column_name = 'organizacion_id'
    """))
    if result.scalar() == 'YES':
        await conn.execute(text("ALTER TABLE aaces.usuarios ALTER COLUMN organizacion_id SET NOT NULL"))
        logger.info("organizacion_id SET NOT NULL")
    
    # Verificar CHECK constraint
    result = await conn.execute(text("""
        SELECT 1 FROM information_schema.check_constraints cc
        JOIN information_schema.constraint_column_usage ccu ON cc.constraint_name = ccu.constraint_name
        WHERE ccu.table_schema = 'aaces' AND ccu.table_name = 'usuarios' AND ccu.column_name = 'rol'
        AND cc.check_clause LIKE '%admin%staff%'
    """))
    if not result.scalar():
        await conn.execute(text("ALTER TABLE aaces.usuarios ADD CONSTRAINT check_rol_usuario CHECK (rol IN ('admin', 'staff'))"))
        logger.info("check_rol_usuario agregado")
    
    # Verificar FK
    result = await conn.execute(text("""
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'aaces' AND table_name = 'usuarios' 
        AND constraint_name = 'fk_usuarios_organizacion'
    """))
    if not result.scalar():
        await conn.execute(text("""
            ALTER TABLE aaces.usuarios 
            ADD CONSTRAINT fk_usuarios_organizacion 
            FOREIGN KEY (organizacion_id) REFERENCES aaces.organizaciones(id) ON DELETE CASCADE
        """))
        logger.info("fk_usuarios_organizacion agregada")
```

**Estrategia**: Cada función verifica estado actual antes de actuar. `ensure_schema()` las llama en orden. Seguro para re-ejecutar.

---

## Cambios de Código

### 1. Models — `app/models/__init__.py`

**Agregar:**
```python
class UsuarioPlataforma(Base):
    __tablename__ = "usuarios_plataforma"
    __table_args__ = {"schema": "aaces"}
    
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    correo: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    rol: Mapped[str] = mapped_column(String(30), default="super_admin", nullable=False)
    activo: Mapped[bool] = mapped_column(default=True, nullable=False)
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now(), nullable=False)
    fecha_actualizacion: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now(), onupdate=func.now(), nullable=False)
```

**Modificar `Usuario`:**
```python
class Usuario(Base):
    __tablename__ = "usuarios"
    __table_args__ = (
        UniqueConstraint("organizacion_id", "correo", name="uq_usuarios_org_correo"),
        {"schema": "aaces"}
    )
    
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    organizacion_id: Mapped[UUID] = mapped_column(
        ForeignKey("aaces.organizaciones.id", ondelete="CASCADE"), 
        nullable=False  # ← CAMBIO: era nullable=True
    )
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    correo: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    rol: Mapped[str] = mapped_column(String(30), default="admin", nullable=False)
    # ... resto igual
```

**NO eliminar** `Cliente`, `Administrador`, `SuperAdmin` — quedan para Fase 2.

### 2. Schemas — `app/schemas/__init__.py`

**Agregar `PlataformaUserResponse`:**
```python
class PlataformaUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    nombre: str
    correo: EmailStr
    rol: str
    activo: bool
    fecha_creacion: datetime
    fecha_actualizacion: datetime
    # NO organizacion_id, NO ciudad_base, NO categoria, NO plan, NO cursos_*
```

**`ClienteResponse`** — mantener igual (para usuarios de organización).

### 3. Auth Service — `app/services/auth.py`

**Nuevo método `authenticate_user`:**
```python
async def authenticate_user(
    db: AsyncSession, 
    correo: str, 
    password: str
) -> tuple[Union[UsuarioPlataforma, Usuario], str]:  # returns (user, source)
    """
    Flujo determinístico, SIN fallback ambiguo:
    1. Buscar en usuarios_plataforma por correo
    2. Si encontrado y password ok → return (user, "plataforma")
    3. Buscar en usuarios por correo + JOIN organizaciones (estatus='activa')
    4. Si encontrado y password ok → return (user, "usuario")
    5. Raise InvalidCredentialsError
    """
```

**Modificar `create_access_token`:**
```python
def create_access_token(self, user: Union[UsuarioPlataforma, Usuario], source: str) -> str:
    payload = {
        "sub": str(user.id),
        "correo": user.correo,
        "nombre": user.nombre,
        "rol": user.rol,
        "source": source,  # ← OBLIGATORIO: "plataforma" | "usuario"
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        "type": "access"
    }
    if source == "usuario":
        payload["org_id"] = str(user.organizacion_id)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
```

**Modificar `get_user_by_id` — signature cambia:**
```python
async def get_user_by_id(
    self, 
    db: AsyncSession, 
    user_id: UUID, 
    source: Literal["plataforma", "usuario"]  # ← OBLIGATORIO, no opcional
) -> Union[UsuarioPlataforma, Usuario]:
    if source == "plataforma":
        stmt = select(UsuarioPlataforma).where(UsuarioPlataforma.id == user_id)
    else:
        stmt = select(Usuario).where(Usuario.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise ResourceNotFoundError("Usuario no encontrado")
    return user
```

**Eliminar** `_authenticate_cliente` y cualquier fallback a tabla `clientes`.

### 4. Auth Endpoints — `app/api/v1/endpoints/auth.py`

**`POST /login`:**
```python
@router.post("/login", response_model=TokenResponse)
async def login(credentials: LoginRequest, db: AsyncSession = Depends(get_db)):
    user, source = await auth_service.authenticate_user(db, credentials.correo, credentials.password)
    access_token = auth_service.create_access_token(user, source)
    refresh_token = auth_service.create_refresh_token(user, source)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
```

**`GET /me`:**
```python
@router.get("/me")
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    payload = auth_service.decode_token(credentials.credentials)
    source = payload.get("source")
    if source not in ("plataforma", "usuario"):
        raise HTTPException(401, "Token inválido: source faltante o inválido")
    
    user_id = UUID(payload["sub"])
    user = await auth_service.get_user_by_id(db, user_id, source)
    
    if source == "plataforma":
        return PlataformaUserResponse.model_validate(user)
    else:
        return ClienteResponse.model_validate(user)
```

### 5. Seed — `app/bootstrap/seed.py`

**Variables de entorno requeridas (`.env`):**
```bash
PLATFORM_USER_EMAIL=tu-email@dominio.com
PLATFORM_USER_PASSWORD=****  # NUNCA hardcodeado
DEMO_ORG_RFC=AAC123456789
DEMO_ADMIN_EMAIL=admin@aaces.com
DEMO_ADMIN_PASSWORD=****
```

**Nuevas funciones:**
```python
async def _ensure_platform_user(conn: AsyncConnection, hash_password_fn: Callable) -> UUID:
    email = os.getenv("PLATFORM_USER_EMAIL")
    pwd = os.getenv("PLATFORM_USER_PASSWORD")
    if not email or not pwd:
        raise RuntimeError("PLATFORM_USER_EMAIL y PLATFORM_USER_PASSWORD requeridos")
    
    # Verificar si ya existe
    result = await conn.execute(text(
        "SELECT id FROM aaces.usuarios_plataforma WHERE correo = :email"
    ), {"email": email})
    existing = result.scalar()
    if existing:
        logger.info(f"Platform user ya existe: {existing}")
        return existing
    
    # Crear
    user_id = uuid.uuid4()
    await conn.execute(text("""
        INSERT INTO aaces.usuarios_plataforma (id, correo, nombre, password_hash, rol, activo)
        VALUES (:id, :email, :name, :ph, 'super_admin', true)
    """), {"id": user_id, "email": email, "name": "Platform Admin", "ph": hash_password_fn(pwd)})
    logger.info(f"Platform user creado: {user_id}")
    return user_id


async def _ensure_demo_org_and_admin(conn: AsyncConnection, hash_password_fn: Callable) -> tuple[UUID, UUID]:
    rfc = os.getenv("DEMO_ORG_RFC", "AAC123456789")
    admin_email = os.getenv("DEMO_ADMIN_EMAIL", "admin@aaces.com")
    admin_pwd = os.getenv("DEMO_ADMIN_PASSWORD", "admin123")
    
    # 1. Buscar/crear organización por RFC
    result = await conn.execute(text(
        "SELECT id FROM aaces.organizaciones WHERE rfc = :rfc"
    ), {"rfc": rfc})
    org_id = result.scalar()
    
    if not org_id:
        org_id = uuid.uuid4()
        await conn.execute(text("""
            INSERT INTO aaces.organizaciones (id, rfc, razon_social, nombre_comercial, estatus, fecha_activacion)
            VALUES (:id, :rfc, 'AACES Demo', 'AACES Demo', 'activa', now())
        """), {"id": org_id, "rfc": rfc})
        logger.info(f"Organización demo creada: {org_id}")
    elif org_id:
        # Reactivar si estaba cancelada
        await conn.execute(text("""
            UPDATE aaces.organizaciones SET estatus = 'activa', fecha_activacion = now() WHERE id = :id
        """), {"id": org_id})
        logger.info(f"Organización demo reactivada: {org_id}")
    
    # 2. Verificar si admin ya existe en esta org
    result = await conn.execute(text("""
        SELECT id FROM aaces.usuarios WHERE organizacion_id = :org_id AND correo = :email
    """), {"org_id": org_id, "email": admin_email})
    existing = result.scalar()
    if existing:
        logger.info(f"Admin demo ya existe: {existing}")
        return org_id, existing
    
    # 3. Crear admin
    admin_id = uuid.uuid4()
    await conn.execute(text("""
        INSERT INTO aaces.usuarios (id, organizacion_id, nombre, correo, password_hash, rol, activo)
        VALUES (:id, :org_id, 'Administrador', :email, :ph, 'admin', true)
    """), {"id": admin_id, "org_id": org_id, "email": admin_email, "ph": hash_password_fn(admin_pwd)})
    logger.info(f"Admin demo creado: {admin_id}")
    return org_id, admin_id
```

**`ensure_seed_data` orquestador:**
```python
async def ensure_seed_data(conn: AsyncConnection, hash_password_fn: Callable) -> None:
    await conn.execute(text("SET search_path TO aaces"))
    
    # 1. Platform user
    await _ensure_platform_user(conn, hash_password_fn)
    
    # 2. Demo org + admin
    await _ensure_demo_org_and_admin(conn, hash_password_fn)
    
    # NO tocar tablas legacy
    await conn.commit()
```

### 6. Main.py — `app/main.py`

Verificar que `lifespan` llama a `ensure_seed_data` **después** de `ensure_schema` y `ensure_indexes` (ya lo hace).

---

## JWT Especificación

### Access Token Payload

**Platform user:**
```json
{
  "sub": "uuid-usuarios_plataforma",
  "correo": "tu-email@dominio.com",
  "nombre": "Platform Admin",
  "rol": "super_admin",
  "source": "plataforma",
  "exp": 1787516883,
  "type": "access"
}
```

**Org user:**
```json
{
  "sub": "uuid-usuarios",
  "correo": "admin@aaces.com",
  "nombre": "Administrador",
  "rol": "admin",
  "source": "usuario",
  "org_id": "uuid-organizacion",
  "exp": 1787516883,
  "type": "access"
}
```

### Validaciones en `decode_token`

```python
def decode_token(self, token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        # Validaciones obligatorias
        if "source" not in payload:
            raise HTTPException(401, "Token inválido: falta claim 'source'")
        if payload["source"] not in ("plataforma", "usuario"):
            raise HTTPException(401, "Token inválido: 'source' inválido")
        if payload.get("type") != "access":
            raise HTTPException(401, "Token inválido: no es access token")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expirado")
    except jwt.InvalidTokenError as e:
        logger.error(f"JWT decode error: {e}")
        raise HTTPException(401, "Token inválido o expirado")
```

---

## Multi-Tenancy — Garantía Estructural

| Usuario | Tabla | `organizacion_id` | Acceso |
|---------|-------|-------------------|--------|
| Platform | `usuarios_plataforma` | **NO EXISTE** | Todas las orgs (dashboard, métricas globales) |
| Org | `usuarios` | **NOT NULL FK → organizaciones** | Solo su org (via `WHERE organizacion_id = current_user.organizacion_id`) |

**Enforcement en queries:**
```python
# En cualquier servicio que lea datos de organización:
async def get_cursos(db: AsyncSession, current_user: Usuario) -> List[Curso]:
    # current_user SIEMPRE tiene organizacion_id NOT NULL
    stmt = select(Curso).where(Curso.organizacion_id == current_user.organizacion_id)
    # IMPOSIBLE acceder a org B aunque se conozca el UUID
```

---

## Backup Procedure

### Antes del Deploy

```bash
# 1. Backup manual via Render Dashboard
# Render → Databases → aaces-db → Backups → "Create Manual Backup"
# Nombre: "pre-phase1-$(date +%Y%m%d_%H%M%S)"

# 2. Verificar backup existe
# Render Dashboard → Backups → debe aparecer con status "Completed"

# 3. pg_dump local (opcional, para test local)
pg_dump -h <render-host> -U aaces_user -d aaces_db -n aaces \
  --no-owner --no-privileges \
  > /tmp/aaces_pre_phase1_$(date +%Y%m%d_%H%M%S).sql
```

### Qué respalda el backup

- **Schema completo** `aaces` (todas las tablas, índices, constraints)
- **Datos demo** en todas las tablas (incluyendo legacy)
- **Relaciones** (FKs, PKs, UNIQUE, CHECK)

### Restauración si falla

```bash
# Opción A: Render Dashboard → Backups → "Restore" (reemplaza BD completa)
# Opción B: pg_restore local si se hizo pg_dump
pg_restore -h <render-host> -U aaces_user -d aaces_db -n aaces /tmp/backup.sql
```

---

## Rollback Strategy

### Rollback de Deploy (Render)

| Evento | Acción |
|--------|--------|
| Health check falla | Render **no rota tráfico** al nuevo container; container viejo sigue sirviendo |
| Container crash | Render reinicia container viejo automáticamente |
| **BD** | **NO se revierte** — cambios de `ensure_schema()` persisten |

### Rollback de Base de Datos

| Escenario | Procedimiento |
|-----------|---------------|
| `ensure_schema()` falla a mitad | **DDL no transaccional en PG** → tablas parciales creadas. Requiere: 1) Restore backup, 2) Fix código, 3) Redeploy |
| `ensure_seed_data()` falla | Datos parciales insertados. Requiere: 1) Restore backup, 2) Fix seed, 3) Redeploy |
| Deploy exitoso pero bugs en prod | **No hay rollback automático de BD**. Opciones: 1) Hotfix + redeploy, 2) Restore backup + redeploy código viejo |

**Regla de oro**: `ensure_schema()` y `ensure_seed_data()` deben ser **idempotentes y reversibles solo via backup**.

---

## Tests Obligatorios (Pre-Deploy Local)

### Test Setup

```bash
# 1. Restaurar backup en PG local
docker run -d --name pg-test -e POSTGRES_DB=aaces_db -e POSTGRES_USER=aaces_user -e POSTGRES_PASSWORD=*** -p 5433:5432 postgres:15
psql -h localhost -p 5433 -U aaces_user -d aaces_db < /tmp/aaces_pre_phase1_*.sql

# 2. Configurar .env.local con credenciales de test
cp .env.example .env.local
# Editar PLATFORM_USER_EMAIL, PLATFORM_USER_PASSWORD, etc.
```

### Test 1: Platform Login Flow

```python
# tests/test_auth_phase1.py
async def test_platform_login_returns_plataforma_source():
    async with AsyncSessionLocal() as db:
        # Login platform user
        resp = await client.post("/api/v1/auth/login", json={
            "correo": os.getenv("PLATFORM_USER_EMAIL"),
            "password": os.getenv("PLATFORM_USER_PASSWORD")
        })
        assert resp.status_code == 200
        token = resp.json()["access_token"]
        
        # Decode JWT
        payload = jwt.decode(token, options={"verify_signature": False})
        assert payload["source"] == "plataforma"
        assert "org_id" not in payload
        
        # /me
        resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["correo"] == os.getenv("PLATFORM_USER_EMAIL")
        assert "organizacion_id" not in data
        assert "categoria" not in data  # PlataformaUserResponse no tiene estos campos
```

### Test 2: Organization Login Flow

```python
async def test_org_login_returns_usuario_source():
    async with AsyncSessionLocal() as db:
        resp = await client.post("/api/v1/auth/login", json={
            "correo": "admin@aaces.com",
            "password": "admin123"
        })
        assert resp.status_code == 200
        token = resp.json()["access_token"]
        
        payload = jwt.decode(token, options={"verify_signature": False})
        assert payload["source"] == "usuario"
        assert "org_id" in payload
        
        resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["correo"] == "admin@aaces.com"
        assert "organizacion_id" in data
        assert data["categoria"] == "enterprise"  # admin → enterprise
```

### Test 3: JWT Source Isolation

```python
async def test_platform_token_cannot_access_org_endpoints():
    # Login platform
    token = await login_platform()
    
    # Intentar acceder a endpoint que requiere org context
    # (ej: listar cursos de una org específica)
    resp = await client.get("/api/v1/cursos", headers={"Authorization": f"Bearer {token}"})
    # Debe fallar o retornar vacío — platform user no tiene org_id
    assert resp.status_code in (403, 400)  # según diseño de endpoints
```

### Test 4: Org Token Cannot Impersonate Platform

```python
async def test_org_token_cannot_access_platform_endpoints():
    token = await login_org()
    
    # Intentar acceder a endpoint solo platform (ej: listar todas las orgs)
    resp = await client.get("/api/v1/admin/organizaciones", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403
```

### Test 5: Cross-Org Access Blocked

```python
async def test_org_user_cannot_access_other_org_data():
    # Crear segunda org + admin en seed/test setup
    org_b_id = await create_org_b()
    user_b_token = await login_as_org_b_admin()
    
    # User B intenta leer cursos de org A (conocido UUID)
    resp = await client.get(
        f"/api/v1/cursos?organizacion_id={ORG_A_ID}", 
        headers={"Authorization": f"Bearer {user_b_token}"}
    )
    # Debe retornar 0 resultados o 403 — NUNCA datos de org A
    assert resp.status_code == 200
    assert len(resp.json()) == 0
```

### Test 6: Seed Idempotency

```python
async def test_seed_idempotent():
    async with AsyncSessionLocal() as db:
        async with db.bind.connect() as conn:
            await ensure_seed_data(conn, pwd_context.hash)
            await conn.commit()
        
        # Contar
        platform_count = await count_table(conn, "usuarios_plataforma")
        org_count = await count_table(conn, "usuarios")
        org_org_count = await count_table(conn, "organizaciones")
        
        # Segunda ejecución
        async with db.bind.connect() as conn:
            await ensure_seed_data(conn, pwd_context.hash)
            await conn.commit()
        
        # Verificar MISMOS conteos y UUIDs
        assert await count_table(conn, "usuarios_plataforma") == platform_count
        assert await count_table(conn, "usuarios") == org_count
        assert await count_table(conn, "organizaciones") == org_org_count
        
        # Verificar UUIDs idénticos
        platform_ids_1 = await get_ids(conn, "usuarios_plataforma")
        platform_ids_2 = await get_ids(conn, "usuarios_plataforma")
        assert platform_ids_1 == platform_ids_2
```

### Test 7: Legacy Tables Intact

```python
async def test_legacy_tables_unchanged():
    async with AsyncSessionLocal() as db:
        async with db.bind.connect() as conn:
            # Verificar tablas existen
            for table in ["clientes", "administradores", "super_administradores"]:
                result = await conn.execute(text(f"""
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_schema = 'aaces' AND table_name = '{table}'
                """))
                assert result.scalar() == 1, f"Tabla legacy {table} eliminada"
            
            # Verificar FKs hacia clientes intactas
            fks = await conn.execute(text("""
                SELECT count(*) FROM information_schema.table_constraints
                WHERE constraint_type = 'FOREIGN KEY' 
                AND table_schema = 'aaces'
                AND constraint_name LIKE '%clientes%'
            """))
            assert fks.scalar() >= 12  # Al menos las 12 FKs conocidas
```

### Test 8: Restart Stability

```python
async def test_restart_stability():
    # 1. Start app
    # 2. Login platform → /me 200
    # 3. Login org → /me 200
    # 4. Restart app (simular: nueva conexión, lifespan corre de nuevo)
    # 5. Login platform → /me 200
    # 6. Login org → /me 200
    # 7. Health check → 200
    pass  # Implementar con testcontainers o reiniciando proceso
```

---

## Archivos a Modificar

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `app/models/__init__.py` | Modify | Agregar `UsuarioPlataforma`, modificar `Usuario` (NOT NULL, constraints) |
| `app/schemas/__init__.py` | Modify | Agregar `PlataformaUserResponse` |
| `app/services/auth.py` | Modify | `authenticate_user`, `create_access_token`, `get_user_by_id`, `decode_token` |
| `app/api/v1/endpoints/auth.py` | Modify | `login`, `get_current_user` |
| `app/bootstrap/schema.py` | Modify | `create_usuarios_plataforma`, `alter_usuarios_add_constraints` |
| `app/bootstrap/seed.py` | Modify | `_ensure_platform_user`, `_ensure_demo_org_and_admin`, `ensure_seed_data` |
| `.env.example` | Modify | Agregar vars `PLATFORM_USER_EMAIL`, `PLATFORM_USER_PASSWORD`, etc. |
| `config/.env.example` | Modify | Idem |
| `config/.env.production` | Modify | Idem (sin valores reales) |

---

## Verificación Pre-Deploy (Checklist)

- [ ] Backup manual creado en Render Dashboard
- [ ] `pg_dump` local verificado (restaurable)
- [ ] Test local: `DROP SCHEMA aaces CASCADE; CREATE SCHEMA aaces;` + `ensure_schema()` → tablas correctas
- [ ] Test local: `seed()` 2x → UUIDs idénticos, 0 duplicados
- [ ] Test local: 8 tests obligatorios pasan
- [ ] `acceptance_api.py` 15/15 cases pasan
- [ ] No referencias a `clientes`/`administradores`/`super_administradores` en código nuevo (grep -r)
- [ ] Variables de entorno documentadas para Render

---

## Criterios de Éxito (Deploy a Render)

| Criterio | Verificación |
|----------|--------------|
| Deploy exitoso | Render build OK, container start OK, health check 200 |
| `/health` | `{"status": "healthy"}` |
| Platform login | `POST /auth/login` → 200, JWT `source="plataforma"` |
| Platform `/me` | `GET /auth/me` → 200, `PlataformaUserResponse`, sin `organizacion_id` |
| Org login | `POST /auth/login` → 200, JWT `source="usuario"`, `org_id` presente |
| Org `/me` | `GET /auth/me` → 200, `ClienteResponse`, con `organizacion_id` |
| Cross-tenant block | User org A no ve datos org B (Test 5) |
| Legacy intact | Tablas `clientes`, `administradores`, `super_administradores` existen con FKs |

---

## Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| `ensure_schema()` crea tablas a medias | Media | Alto | Test local con `DROP SCHEMA CASCADE` antes de deploy |
| Seed falla por FKs legacy no limpiadas | **Alta** (ya pasa) | Alto | Seed NO toca tablas legacy en Fase 1; solo inserta en nuevas |
| Variables de entorno faltantes en Render | Media | Alto | Verificar en Render Dashboard antes de push |
| Frontend rompe por respuesta `/me` distinta | Alta | Medio | Deploy backend primero; frontend en PR separado |
| `organizacion_id` NULL en usuarios existentes | Media | Alto | `alter_usuarios_add_constraints` solo SET NOT NULL si no hay NULLs; si hay, log warning y no aplicar |

---

## Fase 2 (Documentada, NO Ejecutar Ahora)

> **Fuera de alcance de este plan.** Para sesión posterior.

1. Auditar 18 FKs → `clientes`/`usuarios`
2. Identificar tablas negocio que realmente usan `clientes` vs `usuarios`
3. Migrar datos negocio necesarios de `clientes` → `usuarios` (si aplica)
4. `DROP TABLE clientes, administradores, super_administradores`
5. Eliminar modelos legacy de `models/__init__.py`
6. Limpiar código que referencie tablas legacy
7. Seed final sin referencias legacy

---

## Execution Order (Task List)

### Setup & Schema
1. Add `UsuarioPlataforma` model + modify `Usuario` (NOT NULL, constraints)
2. Add `PlataformaUserResponse` schema
3. Implement `create_usuarios_plataforma()` + `alter_usuarios_add_constraints()` in `schema.py`
4. Verify `ensure_schema()` order: platform table → usuarios alters

### Auth Logic
5. Rewrite `authenticate_user()` — deterministic 2-table flow, no fallback
6. Modify `create_access_token()` — add mandatory `source` claim
7. Modify `get_user_by_id(user_id, source)` — source required, no fallback
8. Harden `decode_token()` — validate `source` claim

### Endpoints
9. Update `POST /login` — use new auth flow, return token with `source`
10. Update `GET /me` — read `source` from JWT, validate correct response model

### Seed
11. Add env vars for platform/demo credentials
12. Implement `_ensure_platform_user()` — idempotent, env-driven
13. Implement `_ensure_demo_org_and_admin()` — idempotent, RFC-based org reuse
14. Update `ensure_seed_data()` orchestration

### Verification
15. Local test: clean DB → schema → seed 2x → UUIDs stable
16. Local test: 8 mandatory tests pass
17. Local test: acceptance_api.py 15/15
18. Backup Render → Deploy → Verify all success criteria

---

## Open Questions (Resolver Antes de Implementar)

1. **Platform user email/password**: ¿Valores definitivos para `.env.production` o placeholders?
2. **Endpoints platform-only**: ¿Qué endpoints existentes son solo para platform user? (ej: `/admin/organizaciones`, métricas globales)
3. **Refresh token**: ¿Incluir `source` en refresh token también? (Recomendado: sí)
4. **Password policy**: ¿Aplicar misma política a platform user? (Recomendado: sí)

---

**Plan complete. Ready for review. No implementation until authorized.**