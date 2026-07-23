# ARCHITECTURE_RULES.md — AACES2

Reglas de arquitectura que **no se rompen**. Pequeño equipo hoy, crítico mañana.
Si una regla entra en conflicto con una feature, la feature se rediseña; la regla no.

---

## 1. Backend: un solo punto de entrada
- Existe **UN** backend: `backend/main.py` (`uvicorn main:app`).
- No hay `legacy/`, `routes/`, `run.py` alternativos ni segundo proceso en el mismo puerto.
- El reloader (`--reload`) genera un hijo `multiprocessing-fork`; **no** es un segundo backend. Antes de diagnosticar "2 backends", correr `lsof -i :8000` y `ps aux | grep uvicorn`.

## 2. API del frontend: una sola configuración
- Única fuente: `frontend/app/services/api.ts` (`API_BASE_URL = '/api/v1'`) + rewrite en `frontend/next.config.js` → `127.0.0.1:8000`.
- `frontend/.env.local`: `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000`.
- El frontend **nunca** construye URLs manualmente a otros hosts. Siempre pasa por el cliente API (`apiRequest` / `lib/api.ts`).
- En dev las rutas son relativas (`/api/v1/...`); el rewrite las resuelve server-side (evita CORS y el bug de `localhost`→IPv6).

## 3. Identidad: un único contrato (CurrentUser)
- **Ningún endpoint lee el JWT directamente.** Todos dependen de `get_current_user_data()`.
- El objeto que produce `get_current_user_data()` es el contrato `CurrentUser` (ver `CONTRACTS.md`).
- Cualquier código que necesite el tenant usa **`organizacion_id`** (identificador canónico del tenant en el backend).
- El JWT puede usar la clave corta `org_id`; `get_current_user_data()` **normaliza** siempre `organizacion_id` en el payload. Los endpoints leen `organizacion_id`, nunca `payload["organization"]` / `payload["tenant"]` / `payload["org_id"]` de forma ad-hoc.
- Si un endpoint nuevo necesita un campo de identidad, se añade al contrato `CurrentUser`, no se lee del JWT.

## 4. Esquema: tres fuentes de verdad siempre alineadas
Todo cambio de esquema se refleja en **tres** lugares:
1. Modelos SQLAlchemy (`app/models/__init__.py`)
2. Bootstrap / SQL de creación (`app/bootstrap/`, `ensure_schema()`)
3. Auditoría (`backend/scripts/audit_schema.py` + `audit_sql_refs.py`)

Antes de liberar: correr ambos scripts de auditoría. Cero desalineaciones sin documentar en `SCHEMA_AUDIT.md`.

## 5. Cambios de FK / reorientación de dominio
- Una reorientación de FK (ej. `cursos.cliente_id` → FK a `organizaciones`) **obliga** a actualizar TODAS las relaciones ORM inversas y TODOS los INSERT/SELECT que usen esa columna, no solo la definición.
- Regla: al mover una FK, buscar con `grep` todas las referencias a la columna vieja en el código y en queries SQL crudas.

## 6. Verificación antes de liberar (Release Gate)
- `RELEASE_CHECKLIST.md` es la lista re-ejecutable. Incluye:
  - `audit_schema.py`, `audit_sql_refs.py`
  - `tests/e2e/flujo_completo.sh`, `tests/e2e/sprint_a_check.sh`
  - `tests/acceptance/core_operativo.py` (5 flujos)
  - Smoke test navegador (Flujo 3 diferenciador: curso→participante→constancia→QR→verificación con datos coherentes)
- **No push** el mismo día de un cambio en auth / JWT / FK / multitenancy / migraciones.
- Cuarentena: congelar → alinear las 3 fuentes → `ensure_schema()` idempotente en BD vacía → RELEASE_CHECKLIST re-ejecutable → merge main → tag hito → push.

## 7. Contratos como API pública
- El backend se trata como API pública: el contrato de cada endpoint (request/response) está definido y no cambia sin versionar.
- `CurrentUser` es el contrato de identidad canónico. Nadie lo salta.

---

Estas reglas nacen de la pausa técnica RC-1 (2026-07-22): el error de crear curso era una desalineación de nombres (`org_id` vs `organizacion_id`) entre el JWT y los endpoints, no una duplicación de backend. Documentar el contrato evita el retorno del fantasma.
