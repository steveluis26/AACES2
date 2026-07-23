# CONTRACTS.md — AACES2

Contratos explícitos de la API. El backend se trata como API pública: el contrato
no cambia sin versionar. Cualquier endpoint nuevo se adhiere a estos contratos.

---

## Auth Contract — `CurrentUser`

`CurrentUser` es el ÚNICO objeto de identidad. Lo produce `get_current_user_data()`
(`app/api/v1/endpoints/auth.py`). Nadie lee el JWT directamente.

### Campos canónicos

| Campo            | Tipo   | Significado                                      | Notas                              |
|------------------|--------|--------------------------------------------------|------------------------------------|
| `sub`            | UUID   | ID del usuario/cliente autenticado               | Siempre presente                   |
| `role`           | str    | `client` \| `admin` \| `trainer` \| `usuario`    | Usado por `require_role`           |
| `org_id`         | UUID   | ID de la organización (tenant)                   | Clave corta en el JWT              |
| `organizacion_id`| UUID   | ID de la organización (tenant) — **canónico**    | `get_current_user_data` lo normaliza = `org_id` |
| `permissions`    | list   | Permisos del usuario                             | Puede ser `[]`                     |
| `source`         | str    | `cliente` \| `usuario`                           | Esquema old/new                   |
| `name` / `email` | str    | Datos de presentación                            | Opcionales                         |

### Reglas del contrato
1. **El tenant canónico es `organizacion_id`.** Cualquier lógica multitenant usa `organizacion_id`, no `sub`, no `org_id` ad-hoc.
2. `get_current_user_data()` garantiza que `organizacion_id` esté presente (de `org_id` del JWT, o resolviendo `clientes.organizacion_id` desde BD para tokens viejos).
3. **Ningún endpoint** hace `payload["organization"]`, `payload["tenant"]`, `request.headers["x-org"]` o lee `decode_token()` directo. Usa `user_data["organizacion_id"]`.
4. Si un endpoint necesita un campo nuevo de identidad, se añade AQUÍ y se normaliza en `get_current_user_data()`.

---

## Dependency Chain (capas, un único punto de entrada cada una)

```
Frontend
   ↓  (services/api.ts — API_BASE_URL='/api/v1')
/api/v1  (next.config.js rewrite → 127.0.0.1:8000)
   ↓
Backend (main.py — FastAPI)
   ↓  (Depends)
get_current_user_data()  →  CurrentUser
   ↓
Servicios / endpoints
```

- Cada capa tiene exactamente un punto de entrada.
- El frontend nunca construye URLs manualmente; usa el cliente API.
- El backend nunca lee el JWT directo; usa `get_current_user_data()`.

---

## Create Curso Contract (ejemplo de contrato de endpoint)

`POST /api/v1/clientes/cursos` (usado por `app/cliente/gestion/page.tsx`)

Request (`CursoCreatePayload`):
- `nombre` (str, req), `ciudad` (str, req), `fecha_inicio` (date, req), `fecha_fin` (date, req)
- `duracion_horas` (int, req), `duracion_validacion` (int, req), `modalidad` (presencial|virtual|mixta)
- `codigo_curso` (str, req), `empresa_contratante` (opt), `costo_total` (opt)

Response 200: `{ id, subcursos, constancias }`

Regla de dominio: el INSERT usa `organizacion_id` como `cliente_id` (la columna
`cursos.cliente_id` es FK a `organizaciones.id` tras la migración Sprint A). El
valor proviene de `CurrentUser.organizacion_id`, nunca de `sub`.

---

## Verificación del contrato
- `backend/scripts/audit_sql_refs.py`: detecta queries SQL crudas que referencien
  columnas inexistentes (ej. `organizaciones.nombre` en vez de `razon_social`).
- `backend/scripts/audit_contract.py`: ningún endpoint lee el JWT directo ni usa
  campos no canónicos de identidad.
- `backend/scripts/audit_tenant.py`: ningún GET de datos de negocio filtra sin
  `organizacion_id` (multi-tenant).
- Para añadir un campo a `CurrentUser`: editar `get_current_user_data()`, documentar
  aquí, y correr la prueba de aceptación (`tests/acceptance/core_operativo.py`).

---

## Dominio: Cursos (regla de flujo único)
Un SaaS maduro tiene UN flujo CRUD por concepto. AACES hoy tiene implementaciones
dispersas (deuda de crecimiento). Regla objetivo:

- `POST   /api/v1/clientes/cursos`        → crear
- `GET    /api/v1/clientes/cursos`        → listar (YA filtra por organizacion_id)
- `GET    /api/v1/clientes/cursos/{id}`   → detalle
- `PUT    /api/v1/clientes/cursos/{id}`   → editar
- `DELETE /api/v1/clientes/cursos/{id}`   → eliminar

"Próximos cursos" NO es otro endpoint con su propio SQL. Es un filtro del listado:
`GET /api/v1/clientes/cursos?estado=proximo` o `?fecha_desde=YYYY-MM-DD`.
Hoy existe `GET /api/v1/clientes/agenda/proximos` (SQL propio) — debe converger.

Ningún endpoint escribe SQL de negocio directo. Todo va por `CourseService`
(create/update/delete/list/get/upcoming) con `organizacion_id` obligatorio.
Estado: pendiente de Sprint B (hardening). RC-1 solo garantiza que los endpoints
existentes filtran por tenant y usan el contrato de identidad.

## Dominio: Participantes / Constancias
Misma regla: un servicio por concepto, filtro `organizacion_id` obligatorio.
Los endpoints de VERIFICACIÓN PÚBLICA (`/verificar/{codigo}`, `/constancias/.../codigo`)
son la excepción legítima: se consultan por código de validación, no por tenant
(ese es el diferenciador comercial: cualquiera puede verificar un certificado).
