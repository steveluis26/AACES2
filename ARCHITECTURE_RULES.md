# ARCHITECTURE_RULES.md — AACES2

Reglas de arquitectura que **no se rompen**. Pequeño equipo hoy, crítico mañana.
Si una regla entra en conflicto con una feature, la feature se rediseña; la regla no.

---

## Reglas de la pausa técnica (infraestructura)

### R1. Backend: un solo punto de entrada
- Existe **UN** backend: `backend/main.py` (`uvicorn main:app`).
- No hay `legacy/`, `routes/`, `run.py` alternativos ni segundo proceso en el mismo puerto.
- El reloader (`--reload`) genera un hijo `multiprocessing-fork`; **no** es un segundo backend. Antes de diagnosticar "2 backends", correr `lsof -i :8000` y `ps aux | grep uvicorn`.

### R2. API del frontend: una sola configuración
- Única fuente: `frontend/app/services/api.ts` (`API_BASE_URL = '/api/v1'`) + rewrite en `frontend/next.config.js` → `127.0.0.1:8000`.
- El frontend **nunca** construye URLs manualmente a otros hosts. Siempre pasa por el cliente API.
- En dev las rutas son relativas (`/api/v1/...`); el rewrite las resuelve server-side (evita CORS).

### R3. Identidad: un único contrato (CurrentUser)
- **Ningún endpoint lee el JWT directamente.** Todos dependen de `get_current_user_data()`.
- El tenant canónico es **`organizacion_id`**. El JWT puede usar `org_id`; `get_current_user_data()` lo normaliza.
- Si un endpoint nuevo necesita un campo de identidad, se añade al contrato `CurrentUser`, no se lee del JWT.

### R4. Esquema: tres fuentes de verdad siempre alineadas
- Modelos SQLAlchemy ↔ Bootstrap/SQL ↔ Auditoría (`audit_schema.py`, `audit_sql_refs.py`).
- Antes de liberar: correr ambos scripts. Cero desalineaciones sin documentar en `SCHEMA_AUDIT.md`.

### R5. Verificación antes de liberar (Release Gate)
- `RELEASE_CHECKLIST.md` es la lista re-ejecutable (audit_schema, audit_sql_refs, audit_tenant, audit_contract, flujo_completo, core_operativo, smoke navegador).
- **No push** el mismo día de un cambio en auth / JWT / FK / multitenancy / migraciones.

---

## Reglas de la ESTABILIZACIÓN (Sprint S) — NO SE ROMPEN

Estas reglas son la cura de la deuda que produjo los "incendios" de RC-1.
Nacen de la decisión de tratar cada dominio como una única fuente de verdad.

### REGLA #1 — Una operación del negocio tiene UNA sola implementación
Crear curso → `CursoService.crear()`. Listar → `CursoService.listar()`.
No importa si la llamada viene de: Admin, Cliente, API, Importador, Marketplace.
**Todos llaman exactamente al mismo método del servicio.**
No hay "esta ruta usa SQL propio porque es el panel del cliente".
Si ya existe `curso_service.listar(...)`, TODAS las rutas lo usan. Sin excepciones.

### REGLA #2 — Los routers NO conocen SQL
La capa API solo: valida el request, delega al servicio, devuelve la respuesta.
Nunca escribe `text("SELECT ...")` ni `select(Modelo)` de negocio.
```
API  →  valida request  →  Service  →  Repository/SQL
NUNCA:  API  →  SQL
```
Esta es una regla ARQUITECTÓNICA, no técnica. Un endpoint que necesite datos
llama a un método de servicio; el servicio posee el SQL.

### REGLA #3 — Todo acceso a CurrentUser pasa por una sola función
Ya resuelto con `get_current_user_data()`. Ningún endpoint hace `decode_token()`
ni lee `request.headers` de auth. Esta regla está vigente y es el gate `audit_contract.py`.

### REGLA #4 — Toda consulta de negocio pasa por auditoría de tenant
Todo `SELECT`/`INSERT` de datos de negocio filtra por `organizacion_id`.
El gate `audit_tenant.py` lo verifica en cada release. Un GET que devuelva datos
de negocio sin filtro de tenant es un blocker (filtración multi-tenant).

---

## Estructura objetivo: `app/services/`

Cada dominio tiene SU servicio. Los routers quedan reducidos a delegación.

```
backend/app/services/
├── curso_service.py          ✅ (Sprint S1 — hecho)
├── participante_service.py    🚧 (Sprint S2)
├── constancia_service.py      🚧 (Sprint S3)
├── documento_service.py       🚧
├── usuario_service.py         🚧
└── organizacion_service.py     🚧
```

Endpoint ejemplo (lo que debe quedar):
```python
@router.post("/clientes/cursos")
async def crear_curso(payload, user_data = Depends(get_current_user_data), db = Depends(get_db)):
    result = await CursoService.crear(db, user_data, payload)
    await db.commit()
    return result
```
Nada más. Sin SQL. Sin lógica de negocio.

## División de `clientes.py` (monolito interno)
Hoy `clientes.py` hace demasiadas cosas: Cursos, Participantes, Agenda, Dashboard,
Pagos, Perfil, Empresas. Debe quedar separado por dominio conforme avanza Sprint S:
cada extracto de lógica pasa a su `service.py` y el router correspondiente queda
en su propio módulo bajo `app/api/v1/endpoints/`. No es "porque quede bonito":
hace mucho más fácil encontrar errores y evita que un bug se duplique en 3 lugares.

---

## Plan Sprint S (Stabilization)
- **S1 ✅ CursoService**: eliminar SQL duplicado de cursos (crear/listar/obtener/agenda). Hecho (commit 27a8faa).
- **S2 ✅ ParticipanteService**: `crear` (enroll + vigencia/costo) + `acreditar`. Endpoints cursos.py:add_participante, participantes.py:create_participante, participantes.py:acreditar_participante delegan. Hecho (commit 0645460). PENDIENTE: clientes.py:add_participante_curso aún tiene SQL (crea participante + emite constancia); su lógica de constancia va a S3.
- **S3** ConstanciaService: `emitir_constancia` (hoy en constancias.py:95 y embebido en clientes.py:add_participante_curso) + `verificar`. Al cerrar S3, clientes.py:add_participante_curso delega en ParticipanteService.crear + ConstanciaService.emitir.
- **S4** DashboardService: métricas del panel (hoy admin.py / reportes.py con SQL suelto).
- **S5** Eliminar SQL de routers: tras S2-S4, los routers son solo `return await service.metodo(...)`. clientes.py se divide por dominio.

Condición hasta el merge de v0.4.0: mantener la disciplina. No aceptar nuevas
consultas SQL duplicadas ni nueva lógica de negocio en los routers. CursoService y
ParticipanteService son el modelo; el resto del sistema los sigue.
