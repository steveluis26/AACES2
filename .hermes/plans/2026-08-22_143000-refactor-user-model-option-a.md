# Refactor User Model - Option A (Separate Platform Users Table) Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Replace the current 3-level nested hierarchy (usuario → administradores → super_admin) with a clean two-table design: `usuarios_plataforma` (platform owners) + `usuarios` (org members with mandatory `organizacion_id`), eliminating all tenant-scoping bugs at the data model level.

**Architecture:** 
- Two physically separate tables = structural impossibility of cross-tenant leakage
- `usuarios_plataforma`: you + future team, `organizacion_id` does not exist here
- `usuarios`: client org users only, `organizacion_id` NOT NULL, `rol IN ('admin', 'staff')`
- Auth flow: try `usuarios_plataforma` first, then `usuarios` JOIN `organizaciones`
- Seed: creates your platform user in `usuarios_plataforma`, demo org admin in `usuarios`

**Tech Stack:** FastAPI, SQLAlchemy 2.0 async, PostgreSQL (Render), Alembic migrations, Pydantic v2

---

## Critical Design Decisions (Locked In)

1. **JWT `source` claim is mandatory** — Login endpoint MUST include `"source": "plataforma"` or `"source": "usuario"` in token payload. `/me` endpoint reads this field directly from decoded JWT to know which table to query. No guessing, no fallback logic.

2. **Two separate response models** — No extended `ClienteResponse` with optionals.
   - `ClienteResponse` → org users only (has `organizacion_id`, `razon_social`, `plan`, `cursos_*`)
   - `PlataformaUserResponse` → platform users only (no `organizacion_id`, no org fields)
   Each endpoint returns its corresponding model. Eliminates silent field-missing bugs.

3. **No backward compatibility** — Zero real users = no legacy tokens to support. Old tokens simply fail (force re-login). Removes conditional branches in `get_user_by_id` and token decode.

4. **Subagent visibility** — Each subagent receives the FULL plan as context, not just its phase. Cross-phase decisions (field names, types, JWT claims) are decided upfront here.

---

## Current State (as of commit d0f329d)

### Working
- `/health` → 200
- `/auth/login` → returns JWT with stable SUB
- Seed idempotent, nuclear FK cleanup, org reactivation by RFC

### Broken
- `/auth/me` → 500 Internal Server Error (serialization mismatch with `ClienteResponse`)
- Current model has 3-level hierarchy causing all the bugs you've been debugging

### Files to Reference
- `backend/app/models/__init__.py` — current models (Usuario, Administrador, SuperAdmin, Cliente, Organizacion, Template, etc.)
- `backend/app/services/auth.py` — `_authenticate_usuario`, `_authenticate_cliente`, `get_user_by_id`
- `backend/app/api/v1/endpoints/auth.py` — `/login`, `/me` endpoints
- `backend/app/bootstrap/seed.py` — current seed logic
- `backend/app/schemas/__init__.py` — `ClienteResponse`, `Token`, etc.
- `backend/app/core/config.py` — settings

---

## Phase 1: Database Migration (Alembic)

### Task 1: Create Alembic migration for new tables

**Objective:** Generate migration that creates `usuarios_plataforma` table and modifies `usuarios` to remove hierarchy columns

**Files:**
- Create: `backend/alembic/versions/XXXX_refactor_user_model_option_a.py`
- Modify: `backend/app/models/__init__.py` (after migration applied)

**Step 1: Write migration file**

```python
"""refactor_user_model_option_a

Revision ID: refactor_user_model_option_a
Revises: <current_head>
Create Date: 2026-08-22

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers
revision = 'refactor_user_model_option_a'
down_revision = '<current_head>'  # TODO: replace with actual head
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Create usuarios_plataforma table
    op.create_table(
        'usuarios_plataforma',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('correo', sa.String(255), unique=True, nullable=False),
        sa.Column('nombre', sa.String(100), nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('rol', sa.String(30), nullable=False, server_default='super_admin'),
        sa.Column('activo', sa.Boolean, nullable=False, server_default=sa.text('true')),
        sa.Column('fecha_creacion', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('fecha_actualizacion', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
        schema='aaces'
    )
    op.create_index('ix_usuarios_plataforma_correo', 'usuarios_plataforma', ['correo'], unique=True, schema='aaces')
    op.create_index('ix_usuarios_plataforma_activo', 'usuarios_plataforma', ['activo'], schema='aaces')
    
    # 2. Create your platform user (replace with your actual email/hash)
    op.execute("""
        INSERT INTO aaces.usuarios_plataforma (correo, nombre, password_hash, rol, activo)
        VALUES ('tu-email@dominio.com', 'Super Admin', '$2b$12$<tu-hash-bcrypt>', 'super_admin', true)
    """)
    
    # 3. Modify usuarios table: drop hierarchy columns, make organizacion_id NOT NULL
    op.drop_constraint('fk_usuarios_administrador_id', 'usuarios', schema='aaces', type_='foreignkey')
    op.drop_column('usuarios', 'administrador_id', schema='aaces')
    op.alter_column('usuarios', 'organizacion_id', 
                    existing_type=UUID(as_uuid=True), 
                    nullable=False, 
                    schema='aaces')
    # Ensure rol only has 'admin' | 'staff'
    op.execute("ALTER TABLE aaces.usuarios DROP CONSTRAINT IF EXISTS check_rol_usuario")
    op.execute("ALTER TABLE aaces.usuarios ADD CONSTRAINT check_rol_usuario CHECK (rol IN ('admin', 'staff'))")
    
    # 4. Drop old hierarchy tables
    op.drop_table('super_administradores', schema='aaces')
    op.drop_table('administradores', schema='aaces')
    op.drop_table('clientes', schema='aaces')  # old schema table

def downgrade() -> None:
    # Reverse: recreate old tables, restore columns, drop usuarios_plataforma
    op.create_table('clientes', ...)
    op.create_table('administradores', ...)
    op.create_table('super_administradores', ...)
    op.add_column('usuarios', sa.Column('administrador_id', UUID(as_uuid=True), sa.ForeignKey('aaces.administradores.id'), schema='aaces'))
    op.alter_column('usuarios', 'organizacion_id', nullable=True, schema='aaces')
    op.drop_table('usuarios_plataforma', schema='aaces')
```

**Step 2: Run migration locally to verify**

```bash
cd /Users/riquer/Documents/trae_projects/AACES_temp/backend
alembic upgrade head
# Verify: psql -c "\dt aaces.*" should show usuarios_plataforma, no administradores/super_administradores/clientes
```

**Step 3: Commit**

```bash
git add backend/alembic/versions/XXXX_refactor_user_model_option_a.py
git commit -m "migration: refactor user model - Option A (separate platform users table)"
```

---

## Phase 2: SQLAlchemy Models

### Task 2: Update models/__init__.py - Add UsuarioPlataforma model

**Objective:** Define new `UsuarioPlataforma` model matching migration

**Files:**
- Modify: `backend/app/models/__init__.py:330-360` (after Organizacion, before Template)

**Step 1: Add model**

```python
class UsuarioPlataforma(Base):
    __tablename__ = "usuarios_plataforma"
    __table_args__ = {'schema': 'aaces'}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    correo = Column(String(255), unique=True, nullable=False)
    nombre = Column(String(100), nullable=False)
    password_hash = Column(String(255), nullable=False)
    rol = Column(String(30), default='super_admin', nullable=False)
    activo = Column(Boolean, default=True)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())
    fecha_actualizacion = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # No organizacion_id, no relationships to organizations

    __table_args__ = (
        Index('ix_usuarios_plataforma_correo', 'correo', unique=True),
        Index('ix_usuarios_plataforma_activo', 'activo'),
    )
```

**Step 2: Update Usuario model - remove administrador_id, make organizacion_id NOT NULL**

```python
class Usuario(Base):
    __tablename__ = "usuarios"
    __table_args__ = {'schema': 'aaces'}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organizacion_id = Column(UUID(as_uuid=True), ForeignKey("organizaciones.id", ondelete="CASCADE"), nullable=False)
    nombre = Column(String(100), nullable=False)
    correo = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    rol = Column(String(30), default='admin', nullable=False)  # only 'admin' | 'staff'
    telefono = Column(String(20))
    activo = Column(Boolean, default=True)
    ultimo_acceso = Column(DateTime(timezone=True))
    intentos_fallidos = Column(Integer, default=0)
    bloqueado_hasta = Column(DateTime(timezone=True))
    must_change_password = Column(Boolean, default=False)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())
    fecha_actualizacion = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    organizacion = relationship("Organizacion", foreign_keys=[organizacion_id], back_populates="usuarios")

    __table_args__ = (
        UniqueConstraint('organizacion_id', 'correo', name='uq_org_correo'),
        CheckConstraint("rol IN ('admin', 'staff')", name="check_rol_usuario"),
        Index('idx_usuarios_org_id', 'organizacion_id'),
        Index('idx_usuarios_correo', 'correo'),
        Index('idx_usuarios_activo', 'activo'),
    )
```

**Step 3: Remove old models (Administrador, SuperAdmin, Cliente)**

Delete lines for: `class Administrador`, `class SuperAdmin`, `class Cliente`

**Step 4: Verify models load**

```bash
cd /Users/riquer/Documents/trae_projects/AACES_temp/backend
python -c "from app.models import UsuarioPlataforma, Usuario; print('Models OK')"
```

**Step 5: Commit**

```bash
git add backend/app/models/__init__.py
git commit -m "models: add UsuarioPlataforma, simplify Usuario, remove hierarchy models"
```

---

## Phase 3: Auth Service

### Task 3: Rewrite authenticate_user to use two-table flow

**Objective:** New auth flow tries `usuarios_plataforma` first, then `usuarios` with org join

**Files:**
- Modify: `backend/app/services/auth.py:75-170` (authenticate_user, _authenticate_usuario, _authenticate_cliente)

**Step 1: Add _authenticate_plataforma method**

```python
async def _authenticate_plataforma(self, db: AsyncSession, email: str, password: str) -> Optional[SimpleNamespace]:
    """Autenticar contra tabla usuarios_plataforma (super admins de la plataforma)"""
    try:
        result = await db.execute(
            text("""
                SELECT id, correo, nombre, rol, activo, password_hash
                FROM aaces.usuarios_plataforma
                WHERE correo = :email AND activo = true
                LIMIT 1
            """),
            {"email": email}
        )
        row = result.fetchone()
        if row is None:
            return None

        user = SimpleNamespace(
            id=row[0], correo=row[1], nombre=row[2], rol=row[3], activo=row[4],
            password_hash=row[5], source="plataforma"
        )

        if not self.verify_password(password, user.password_hash):
            return None

        return user
    except Exception as e:
        logger.exception(f"Error autenticando usuario plataforma: {e}")
        return None
```

**Step 2: Update authenticate_user flow**

```python
async def authenticate_user(self, db: AsyncSession, email: str, password: str) -> Optional[SimpleNamespace]:
    try:
        # 1. Try platform users first (super admins)
        user = await self._authenticate_plataforma(db, email, password)
        if user:
            return user
        
        # 2. Try organization users (client admins/staff)
        user = await self._authenticate_usuario(db, email, password)
        if user:
            return user
        
        return None
    except DomainError:
        raise
    except Exception as e:
        logger.exception(f"Error en autenticación: {e}")
        return None
```

**Step 3: Simplify _authenticate_usuario (remove org status check from SQL, keep in Python)**

```python
async def _authenticate_usuario(self, db: AsyncSession, email: str, password: str) -> Optional[SimpleNamespace]:
    """Autenticar contra nuevo esquema usuarios + organizaciones"""
    try:
        result = await db.execute(
            text("""
                SELECT u.id, u.correo, u.nombre, u.rol, u.activo, u.password_hash,
                       u.intentos_fallidos, u.bloqueado_hasta, u.organizacion_id,
                       o.estatus, o.razon_social
                FROM aaces.usuarios u
                LEFT JOIN aaces.organizaciones o ON o.id = u.organizacion_id
                WHERE u.correo = :email AND u.activo = true
                LIMIT 1
            """),
            {"email": email}
        )
        row = result.fetchone()
        if row is None:
            return None

        # Check org status in Python (cleaner than SQL)
        org_estatus = row[9]
        if org_estatus and org_estatus not in ('activa',):
            raise OrganizationSuspendedError(f"Organización en estado: {org_estatus}")

        user = SimpleNamespace(
            id=row[0], correo=row[1], nombre=row[2], rol=row[3], activo=row[4],
            password_hash=row[5], intentos_fallidos=row[6], bloqueado_hasta=row[7],
            organizacion_id=row[8], org_estatus=row[9], razon_social=row[10],
            source="usuario"
        )

        if not self.verify_password(password, user.password_hash):
            new_intentos = (user.intentos_fallidos or 0) + 1
            bloqueado = None
            if new_intentos >= 5:
                bloqueado = datetime.utcnow() + timedelta(minutes=30)
            await db.execute(
                text("UPDATE aaces.usuarios SET intentos_fallidos = :i, bloqueado_hasta = :b WHERE id = :id"),
                {"i": new_intentos, "b": bloqueado, "id": user.id}
            )
            await db.commit()
            return None

        # Reset failed attempts on success
        if user.intentos_fallidos > 0:
            await db.execute(
                text("UPDATE aaces.usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = :id"),
                {"id": user.id}
            )
            await db.commit()

        return user
    except DomainError:
        raise
    except Exception as e:
        logger.exception(f"Error autenticando usuario: {e}")
        return None
```

**Step 4: Remove _authenticate_cliente entirely** (old clientes table gone)

**Step 5: Commit**

```bash
git add backend/app/services/auth.py
git commit -m "auth: rewrite authenticate_user for two-table flow (plataforma + usuarios)"
```

---

## Phase 4: Get User By ID

### Task 4: Rewrite get_user_by_id for two-table lookup (reads source from JWT)

**Objective:** Query correct table based on `source` claim from decoded JWT — no fallback, no guessing

**Files:**
- Modify: `backend/app/services/auth.py:200-270` (get_user_by_id)

**Step 1: Update get_user_by_id — source is REQUIRED parameter (comes from JWT)**

```python
async def get_user_by_id(self, db: AsyncSession, user_id: str, source: str) -> Optional[SimpleNamespace]:
    """Obtener usuario por ID - source OBLIGATORIO desde JWT claim"""
    if source not in ("plataforma", "usuario"):
        logger.error(f"Invalid source claim in JWT: {source}")
        return None
    
    try:
        uid = uuid.UUID(user_id)
        
        if source == "plataforma":
            result = await db.execute(
                text("""
                    SELECT id, correo, nombre, rol, activo, 
                           NULL as organizacion_id, NULL as ciudad_base,
                           fecha_creacion, fecha_actualizacion, NULL as ultimo_acceso,
                           NULL as vigencia_desde, NULL as vigencia_hasta
                    FROM aaces.usuarios_plataforma
                    WHERE id = :id AND activo = true
                """),
                {"id": uid}
            )
            row = result.fetchone()
            if row:
                return SimpleNamespace(
                    id=row[0], correo=row[1], nombre=row[2], rol=row[3], activo=row[4],
                    organizacion_id=None, ciudad_base=None,
                    fecha_creacion=row[5], fecha_actualizacion=row[6],
                    ultimo_acceso=row[7], vigencia_desde=row[8], vigencia_hasta=row[9]
                )
            return None
        
        # source == "usuario"
        result = await db.execute(
            text("""
                SELECT u.id, u.correo, u.nombre, u.rol, u.activo,
                       u.organizacion_id, u.fecha_creacion, u.fecha_actualizacion,
                       u.ultimo_acceso, o.fecha_activacion as vigencia_desde, NULL as vigencia_hasta,
                       o.razon_social
                FROM aaces.usuarios u
                LEFT JOIN aaces.organizaciones o ON o.id = u.organizacion_id
                WHERE u.id = :id
                LIMIT 1
            """),
            {"id": uid}
        )
        row = result.fetchone()
        if row is not None:
            return SimpleNamespace(
                id=row[0], correo=row[1], nombre=row[2], rol=row[3], activo=row[4],
                organizacion_id=row[5], ciudad_base=None,
                fecha_creacion=row[6], fecha_actualizacion=row[7],
                ultimo_acceso=row[8], vigencia_desde=row[9], vigencia_hasta=row[10],
                razon_social=row[11]
            )
        return None
    except Exception as e:
        logger.exception(f"Error get_user_by_id({user_id}, source={source}): {e}")
        return None
```

**Step 2: Update /me endpoint — read source from JWT, pass to get_user_by_id**

**Files:**
- Modify: `backend/app/api/v1/endpoints/auth.py:198-210`

```python
user_id = payload.get("sub")
source = payload.get("source")  # REQUIRED: "plataforma" or "usuario"
if not source:
    logger.error("JWT missing required 'source' claim")
    raise HTTPException(status_code=401, detail="Token inválido: falta claim source")
user = await auth_service.get_user_by_id(db, user_id, source)
```

**Step 3: Update login to include source in token payload**

**Files:**
- Modify: `backend/app/api/v1/endpoints/auth.py:82-94`

```python
token_data = {
    "sub": str(user.id),
    "email": user.correo,
    "role": role,
    "name": user.nombre,
    "source": getattr(user, "source", "usuario"),  # Set by authenticate_user: "plataforma" or "usuario"
}
if org_id:
    token_data["org_id"] = org_id
```

**Step 4: Commit**

```bash
git add backend/app/services/auth.py backend/app/api/v1/endpoints/auth.py
git commit -m "auth: get_user_by_id requires source from JWT; login includes source claim"
```

---

## Phase 5: Seed

### Task 5: Rewrite seed.py for new model

**Objective:** Seed creates platform user in `usuarios_plataforma`, demo org + admin in `usuarios`

**Files:**
- Modify: `backend/app/bootstrap/seed.py` (replace entire _ensure_admin)

**Step 1: New _ensure_platform_user**

```python
async def _ensure_platform_user(conn: AsyncConnection, hash_password_fn) -> None:
    """Ensure platform super admin exists in usuarios_plataforma"""
    PLATFORM_EMAIL = "tu-email@dominio.com"  # Your actual email
    
    existing = await conn.execute(
        text("SELECT id FROM aaces.usuarios_plataforma WHERE correo = :email"),
        {"email": PLATFORM_EMAIL}
    )
    if existing.scalar():
        logger.info("Platform user already exists, skipping")
        return
    
    ph = hash_password_fn("tu-password-seguro")  # Your actual password
    await conn.execute(
        text("""
            INSERT INTO aaces.usuarios_plataforma (correo, nombre, password_hash, rol, activo)
            VALUES (:email, 'Super Admin', :ph, 'super_admin', true)
        """),
        {"email": PLATFORM_EMAIL, "ph": ph}
    )
    logger.info("Platform super admin created")
```

**Step 2: New _ensure_demo_org_and_admin**

```python
async def _ensure_demo_org_and_admin(conn: AsyncConnection, hash_password_fn) -> None:
    """Ensure demo organization and admin user exist in usuarios table"""
    DEMO_ORG_RFC = "AAC123456789"
    ADMIN_EMAIL = "admin@aaces.com"
    ADMIN_PASSWORD = "admin123"
    
    # Get or create demo org
    org_result = await conn.execute(
        text("SELECT id FROM aaces.organizaciones WHERE rfc = :rfc"),
        {"rfc": DEMO_ORG_RFC}
    )
    org_id = org_result.scalar()
    
    if not org_id:
        # Create new demo org
        org_result = await conn.execute(
            text("""
                INSERT INTO aaces.organizaciones (rfc, razon_social, nombre_comercial, email_contacto, estatus)
                VALUES (:rfc, 'AACES Demo', 'AACES Demo', :email, 'activa')
                RETURNING id
            """),
            {"rfc": DEMO_ORG_RFC, "email": ADMIN_EMAIL}
        )
        org_id = org_result.scalar()
        logger.info(f"Demo organization created: {org_id}")
    else:
        # Reactivate if cancelled
        await conn.execute(
            text("UPDATE aaces.organizaciones SET estatus = 'activa' WHERE id = :id AND estatus = 'cancelada'"),
            {"id": org_id}
        )
        logger.info(f"Demo organization reactivated: {org_id}")
    
    # Create/check admin user
    existing = await conn.execute(
        text("SELECT id FROM aaces.usuarios WHERE correo = :email AND organizacion_id = :org_id"),
        {"email": ADMIN_EMAIL, "org_id": org_id}
    )
    if existing.scalar():
        logger.info("Demo admin already exists, skipping")
        return
    
    ph = hash_password_fn(ADMIN_PASSWORD)
    await conn.execute(
        text("""
            INSERT INTO aaces.usuarios (nombre, correo, password_hash, rol, activo, organizacion_id)
            VALUES ('Administrador Demo', :email, :ph, 'admin', true, :org_id)
        """),
        {"email": ADMIN_EMAIL, "ph": ph, "org_id": org_id}
    )
    logger.info("Demo admin created")
```

**Step 3: Update seed function**

```python
async def seed_database(db: AsyncSession) -> None:
    conn = db.bind.connect()
    try:
        hash_password_fn = pwd_context.hash
        await _ensure_platform_user(conn, hash_password_fn)
        await _ensure_demo_org_and_admin(conn, hash_password_fn)
        await conn.commit()
    finally:
        conn.close()
```

**Step 4: Commit**

```bash
git add backend/app/bootstrap/seed.py
git commit -m "seed: rewrite for Option A - platform user + demo org/admin"
```

---

## Phase 6: Schemas

### Task 6: Create separate response models for platform vs org users

**Objective:** Two distinct Pydantic models — no shared optional fields that cause silent bugs

**Files:**
- Modify: `backend/app/schemas/__init__.py:50-62` (replace ClienteResponse, add PlataformaUserResponse)

**Step 1: Define PlataformaUserResponse (new)**

```python
class PlataformaUserResponse(BaseSchema):
    """Response model for platform super admins — NO organization fields"""
    id: UUID
    correo: EmailStr
    nombre: str
    rol: str = 'super_admin'
    activo: bool
    fecha_creacion: datetime
    fecha_actualizacion: datetime
    # No organizacion_id, no razon_social, no plan, no cursos_*, no vigencia
```

**Step 2: Keep ClienteResponse for org users only (clean, no platform fields)**

```python
class ClienteResponse(ClienteBase):
    id: UUID
    fecha_creacion: datetime
    fecha_actualizacion: datetime
    estado: str
    ultimo_acceso: Optional[datetime] = None
    vigencia_desde: Optional[date] = None
    vigencia_hasta: Optional[date] = None
    plan: str = 'trial'
    cursos_creados: int = 0
    cursos_max: int = 10
    descuento_pct: int = 0
    organizacion_id: UUID
    razon_social: str
```

**Step 3: Update /me endpoint to return correct model based on source**

**Files:**
- Modify: `backend/app/api/v1/endpoints/auth.py:200-220`

```python
user_id = payload.get("sub")
source = payload.get("source")
if not source:
    raise HTTPException(status_code=401, detail="Token inválido: falta claim source")

user = await auth_service.get_user_by_id(db, user_id, source)

if not user:
    raise HTTPException(status_code=404, detail="Usuario no encontrado")

if source == "plataforma":
    return PlataformaUserResponse(
        id=user.id,
        correo=user.correo,
        nombre=user.nombre,
        rol=user.rol,
        activo=user.activo,
        fecha_creacion=user.fecha_creacion,
        fecha_actualizacion=user.fecha_actualizacion,
    )
else:
    return ClienteResponse(
        id=user.id,
        correo=user.correo,
        nombre=user.nombre,
        estado='activo' if user.activo else 'inactivo',
        fecha_creacion=user.fecha_creacion,
        fecha_actualizacion=user.fecha_actualizacion,
        ultimo_acceso=user.ultimo_acceso,
        vigencia_desde=user.vigencia_desde,
        vigencia_hasta=user.vigencia_hasta,
        plan='trial',
        cursos_creados=0,
        cursos_max=10,
        descuento_pct=0,
        organizacion_id=user.organizacion_id,
        razon_social=user.razon_social,
    )
```

**Step 4: Commit**

```bash
git add backend/app/schemas/__init__.py backend/app/api/v1/endpoints/auth.py
git commit -m "schemas: separate PlataformaUserResponse and ClienteResponse; /me returns correct model"
```

---

## Phase 7: Cleanup & Verification

### Task 7: Remove dead code and verify

**Objective:** Clean up imports, verify all endpoints work

**Files:**
- Check: `backend/app/api/v1/endpoints/*.py` for imports of old models
- Check: `backend/app/services/*.py` for references to Administrador, SuperAdmin, Cliente

**Step 1: Search and remove old imports**

```bash
cd /Users/riquer/Documents/trae_projects/AACES_temp/backend
grep -r "Administrador\|SuperAdmin\|Cliente" --include="*.py" app/ | grep -v "__pycache__" | grep -v ".pyc"
# Fix any remaining references
```

**Step 2: Run local tests**

```bash
# Start local postgres (docker-compose up -d postgres)
# Run backend
uvicorn app.main:app --reload

# Test login platform user
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"correo": "tu-email@dominio.com", "password": "tu-password"}'

# Test login demo org admin
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"correo": "admin@aaces.com", "password": "admin123"}'

# Test /me with both tokens
curl -H "Authorization: Bearer <platform_token>" http://localhost:8000/api/v1/auth/me
curl -H "Authorization: Bearer <org_token>" http://localhost:8000/api/v1/auth/me
```

**Step 3: Run acceptance tests**

```bash
cd /Users/riquer/Documents/trae_projects/AACES_temp/backend
python scripts/acceptance_api.py
# Should pass all 15 test cases
```

**Step 4: Commit cleanup**

```bash
git add -A
git commit -m "cleanup: remove dead code references to old hierarchy models"
```

---

## Phase 8: Deploy to Render

### Task 8: Deploy and verify on Render

**Objective:** Push to main, verify Render deploy, test endpoints

**Step 1: Push and monitor**

```bash
git push origin main
# Monitor Render dashboard for deploy
# Wait for health check
```

**Step 2: Verify endpoints**

```bash
# Health
curl https://aaces-backend-3hw1.onrender.com/health

# Login platform user
curl -X POST https://aaces-backend-3hw1.onrender.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"correo": "tu-email@dominio.com", "password": "tu-password"}'

# Login demo org admin
curl -X POST https://aaces-backend-3hw1.onrender.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"correo": "admin@aaces.com", "password": "admin123"}'

# Test /me with both
curl -H "Authorization: Bearer <token>" https://aaces-backend-3hw1.onrender.com/api/v1/auth/me
```

**Step 3: Verify no cross-tenant leakage**

- Platform user `/me` → no organizacion_id, sees all orgs (dashboard logic TBD)
- Org admin `/me` → has organizacion_id, scoped to their org only

---

## Risks & Tradeoffs

| Risk | Mitigation |
|------|------------|
| Migration fails on Render (data loss) | Test migration locally first on copy of prod DB; backup before deploy |
| Auth breaks for existing tokens | Zero real users — no legacy tokens. Old tokens simply fail (force re-login). |
| Seed creates duplicate platform user | Idempotent check by email in `_ensure_platform_user` |
| Frontend expects old fields | Frontend will need minor updates for new response shapes (separate PR) |
| Subagent isolation | Each subagent receives FULL plan context; cross-phase decisions locked in this plan |

## Open Questions

1. **Your platform credentials**: Need your actual email + password for seed (or generate secure ones)
2. **Frontend changes**: Does Next.js frontend need updates for new user shape? (likely minimal — separate PR)
3. **Dashboard separation**: Platform dashboard (no org filter) vs org dashboard (org filter) - separate PR?

---

## Execution Order

1. **Phase 1** - Migration (run locally, verify)
2. **Phase 2** - Models (apply after migration)
3. **Phase 3** - Auth service (login flow)
4. **Phase 4** - Get user by ID + JWT source
5. **Phase 5** - Seed rewrite
6. **Phase 6** - Schemas
7. **Phase 7** - Cleanup + local test suite
8. **Phase 8** - Deploy to Render + verify

**Estimated time:** 2-3 hours focused work (no production pressure)

---

## Verification Checklist

After full implementation, verify:
- [ ] `alembic upgrade head` works locally
- [ ] Platform user can login, `/me` returns 200 with no `organizacion_id`
- [ ] Demo org admin can login, `/me` returns 200 with `organizacion_id`
- [ ] Platform user JWT has `source: "plataforma"`
- [ ] Org user JWT has `source: "usuario"` + `org_id`
- [ ] Acceptance tests pass (15/15)
- [ ] Render deploy succeeds
- [ ] No cross-tenant data leakage possible (structural guarantee)