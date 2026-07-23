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

## Hallazgo adicional de la pausa (ciclo crear -> mostrar)
El POST /clientes/cursos respondía 200 y el curso SÍ se insertaba, pero el
GET /clientes/cursos no lo mostraba. Causa raíz confirmada con BD:
- El GET filtraba `WHERE cliente_id = sub` (clientes.py:582) mientras el POST
  inserta `cliente_id = organizacion_id` -> el listado no hallaba el curso.
- El INSERT de clientes.py:904 (y subcursos :959) escribía solo `cliente_id`,
  omitiendo `organizacion_id` (columna añadida en la migración) -> cursos con
  `organizacion_id = NULL` -> endpoints que filtran/join por `organizacion_id`
  (acreditar) daban 404.
Fix: GET usa `organizacion_id`; ambos INSERT llenan `organizacion_id = :org_id`.
Lección: "crear funciona, listar no" casi siempre es GET filtrando por `sub`
mientras el POST usa el tenant canónico. Patrón a chequear en toda auditoría.


## Conclusión de la pausa técnica
NO hay 2 backends. El error era una desalineación de nombres de campo entre el JWT
(`org_id`) y el código (`organizacion_id`) en la ruta que usa el frontend. Reparado
centralmente en `get_current_user_data`; los endpoints que leen `organizacion_id`
ahora funcionan. No se reescribió el sistema.

## Hallazgo crítico: el frontend gestion NO usa /clientes/cursos
El reporte "se guarda en BD pero no se muestra" se debía a que `gestion/page.tsx`
carga la tabla "Mis cursos" con **GET /clientes/agenda/proximos**, no con
GET /clientes/cursos. El endpoint `get_proximos_cursos` (clientes.py:649) filtraba
`WHERE cliente_id = sub` -> como los cursos se guardan con `cliente_id = organizacion_id`,
la tabla quedaba sin el curso nuevo. Fix: `cid = organizacion_id or sub` (commit b36e848).
Lección: al debuggear "no aparece", ver SIEMPRE qué GET exacto hace el frontend
(`grep` en page.tsx), no asumir la ruta del POST.

## AUDITORÍA DE FILTRACIÓN MULTI-TENANT (blocker de release)
Script: `backend/scripts/audit_tenant.py`. Resultado: 7 GET de negocio sin filtro
de tenant. Tras cerrar `get_cursos` (select(Curso) -> WHERE organizacion_id), quedan 6:

CERRADO:
- `get_cursos` (clientes.py:342): select(Curso) sin WHERE -> DEVOLVÍA TODOS LOS
  CURSOS DE TODAS LAS ORGS. Bloqueador. Fix: WHERE organizacion_id = current_user.

LEGÍTIMOS (no son filtración de tenant):
- `get_admin_dashboard_metrics` (admin.py:22): admin, ve todo por diseño.
- `validar_certificado` (clientes.py:454) y `get_constancias_por_codigo`
  (validaciones.py:311): endpoints PÚBLICOS de verificación por código -> no por tenant.

PENDIENTES DE HARDENING (post-RC-1, no bloquean pero son riesgos):
- `get_clientes` (clientes.py:72): select(Cliente) sin WHERE -> lista TODOS los
  clientes. Revisar que sea admin-only (rol). Si un cliente autenticado lo llama,
  ve datos de otros clientes.
- `get_pagos_participante` (clientes.py:1153): filtra por cp_id del PATH sin verificar
  que el cp pertenezca al tenant -> IDOR (ver pagos ajenos). Hardening: JOIN
  curso_participante->curso->organizacion_id = current_user.
- `listar_constancias` (constancias.py:135): select(Constancia) sin WHERE -> revisar
  si join a curso/org.

## FLUJO OFICIAL DE CURSOS (regla de arquitectura objetivo)
Hoy existen implementaciones dispersas del mismo concepto:
  POST /clientes/cursos        (crear - clientes.py)
  GET  /clientes/cursos        (listar - clientes.py:342, YA filtra tenant)
  GET  /clientes/agenda/proximos (listar "próximos" - clientes.py:642, SQL propio)
  GET  /cursos                 (listar - cursos.py, SQL propio)
  GET  /cursos/{id}            (detalle - cursos.py)
  PUT/DELETE /clientes/cursos/{id}
Regla objetivo (post-RC): UN endpoint oficial de listado GET /clientes/cursos.
"Próximos" debe ser un filtro de ese (GET /clientes/cursos?estado=proximo o
?fecha_desde=), NO un endpoint con su propio SQL. Sin SQL disperso: todo vía
CourseService.create/update/delete/list/get/upcoming con filtro organizacion_id
obligatorio. Ningún endpoint escribe SQL directo.

## Patrón 'cid' sobrecargado en clientes.py
~16 usos de `cid = user_data.get("sub")`. 'cid' se usa para DOS cosas:
- En GETs: filtra por tenant -> debe ser `organizacion_id`.
- En INSERTs: es `creado_por` (FK a usuarios/clientes) -> debe ser `sub`.
Un `replace_all` ciego rompería las FK de `creado_por`. Por eso los fixes son
quirúrgicos por endpoint. La limpieza (renombrar a `org_id`/`uid`) es trabajo de
Sprint B, no RC-1.

Aceptación Core: 13/13 OK (incluye el ciclo crear -> agenda/proximos del frontend).
