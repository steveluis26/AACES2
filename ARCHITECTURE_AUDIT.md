# ARQUITECTURA 1.0 — Auditoría de pausa técnica (RC-1)

Fecha: 2026-07-22. Motivo: síntomas de "2 backends / rutas duplicadas / FK violation
al crear curso desde el frontend". Objetivo: responder 6 preguntas con hechos, sin
escribir features nuevas.

## Hallazgo principal (causa raíz del error de crear curso)
El frontend `app/cliente/gestion/page.tsx:92` llama `POST /clientes/cursos`.
Ese endpoint (`clientes.py:770` → `POST /api/v1/clientes/cursos`) leía
`user_data.get("organizacion_id")` para el INSERT, pero el JWT del login usa la
clave `org_id` (sin "organizacion_"). Por eso `organizacion_id` era siempre None →
el INSERT ponía `cliente_id = sub` (el id del usuario) → FK violation contra
`organizaciones.id`.

El otro endpoint `cursos.py:46` (`POST /api/v1/cursos`) leía `org_id` (correcto),
por eso "unas rutas funcionaban y otras no" — exactamente el síntoma descrito.

FIX (auth.py `get_current_user_data`): normaliza SIEMPRE `organizacion_id` en el
payload (de `org_id` del JWT, o resolviendo desde `clientes.organizacion_id` en BD
para tokens viejos). Repara los 5 archivos que leen `organizacion_id` sin tocarlos.

## Mapa de arquitectura (6 preguntas)

### 1. ¿Cuántos backends existen realmente?
**UNO.** `backend/main.py` → `app = FastAPI()` → `include_router(api_router, prefix="/api/v1")`.
El supuesto "2do proceso" en :8000 era el hijo `multiprocessing-fork` del reloader
(`--reload`), no un backend distinto. No hay legacy/run.py alternativo.

### 2. ¿Qué router atiende cada endpoint? (trazabilidad)
- `POST /api/v1/clientes/cursos`  → `clientes.py:770`  `crear_curso`  (USA EL FRONTEND gestion)
- `POST /api/v1/cursos`           → `cursos.py:46`    `crear_curso`  (no usado por gestion)
- `POST /api/v1/cursos/{id}/participantes` → `cursos.py:196` `add_participante`
- `GET  /api/v1/clientes/cursos`  → `clientes.py:578` (listar)
- `GET  /api/v1/cursos`           → `cursos.py:103`  (listar, response_model CursoResponseSchema)
- `POST /api/v1/constancias/emitir` → `constancias.py:95`
- `GET  /api/v1/verificar/{cv}`   → `verificar.py:12`
- Auth: `auth.py` (login/register/me), `get_current_user_data` es la dependencia de identidad.

### 3. ¿Qué archivo implementa cada ruta?
Único punto de implementación por dominio bajo `app/api/v1/endpoints/`. NO hay
`legacy/`, `routes/`, ni segunda carpeta de cursos. SÍ hay 2 endpoints de crear
curso (`clientes.py` y `cursos.py`) — redundancia, no duplicado peligroso, pero
el frontend solo usa `/clientes/cursos`.

### 4. ¿Qué proceso escucha cada puerto?
- :8000 → uvicorn `main:app` (backend AACES). Un solo proceso + hijo reloader.
- :3000 → next dev (frontend). Rewrite `/api/*` → `127.0.0.1:8000` (next.config.js).
- Otros (streamlit mission_control en puerto distinto) son herramientas, no backend.

### 5. ¿Cuál es el único punto de entrada del backend?
`backend/main.py` (`uvicorn main:app`). Confirmado: `ls` solo muestra ese main.py.

### 6. ¿Cuál es la única configuración de API del frontend?
- `frontend/.env.local`: `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000`
- `frontend/next.config.js`: `rewriteTarget='http://127.0.0.1:8000'` (dev), rewrite `/api/:path*` → `${rewriteTarget}/api/:path*`
- `frontend/app/services/api.ts`: `API_BASE_URL='/api/v1'` (relativo, via rewrite)
- `frontend/lib/api.ts`: `baseURL=process.env.NEXT_PUBLIC_API_URL`
NO hay URLs hardcodeadas a otros hosts en el frontend (solo next.config.js referenced).

## Riesgos arquitectónicos restantes (documentados, no se tocan en RC-1)
1. **Redundancia de endpoints de curso**: `/clientes/cursos` y `/cursos` ambos crean.
   El modelo de datos ya migró (`cursos.cliente_id` FK → organizaciones), pero el
   nombre de columna `cliente_id` sigue engañoso. El fix de auth.py oculta el
   síntoma; la limpieza de nombres es trabajo de Sprint B, no RC-1.
2. **Ambigüedad de nombres de token**: `org_id` vs `organizacion_id`. Mitigado
   centralmente en `get_current_user_data`. Los 5 archivos que leen `organizacion_id`
   ahora funcionan.
3. **Columnas del modelo que la BD tiene pero el ORM omite** (precio_base,
   grupo_id, vigencia_meses, costo_asignado, descuento): acuerdo de dejarlas fuera
   del RC (ver SCHEMA_AUDIT.md). No rompen.

## Conclusión de la pausa técnica
NO hay 2 backends. El error era una desalineación de nombres de campo entre el JWT
(`org_id`) y el código (`organizacion_id`) en la ruta que usa el frontend. Reparado
en la raíz (normalización en `get_current_user_data`). El backend es uno solo, con
punto de entrada único y frontend con una sola configuración de API.
Aceptación Core: 11/11 OK tras el fix.
