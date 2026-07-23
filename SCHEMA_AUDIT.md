# AUDITORÍA DE ESQUEMA — AACES2 (3 fuentes de verdad)

Fecha: 2026-07-22 | Sprint A completo, en cuarentena RC-1.

## Propósito
Alinear las 3 fuentes de verdad del esquema antes de cualquier push:
1. **Modelos SQLAlchemy** (`backend/app/models/__init__.py`)
2. **BD real** (Postgres `aaces_db`, schema `aaces`)
3. **Bootstrap SQL** (`backend/app/bootstrap/schema.py`)

Regla de cuarentena: las 3 deben describir el mismo dominio.

---

## HALLAZGOS (cruce automatizado + manual)

### A. Tablas en BD que el modelo NO declara
Estas tablas existen en BD y el código las usa vía SQL crudo (no ORM). No es bug,
pero son fuentes de verdad no documentadas en el modelo:

- `contactos` — formulario de contacto (INSERT crudo en `contacto.py`)
- `grupos_curso` — FK `cliente_id → clientes.id`
- `grupo_curso_items` — FK `grupo_id → grupos_curso`, `tipo_curso_id → tipos_curso`
- `tipos_curso` — FK `cliente_id → clientes.id`
- `schema_version` — metadato de bootstrap (no requiere modelo)

### B. Columnas en BD que el MODELO no declara (desalineación modelo↔BD)
El modelo omite estas columnas (la BD las tiene; el código las maneja con
`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` + SQL crudo):

- `cursos`: `precio_base`, `precio_promocional`, `grupo_id`, `curso_padre_id`
- `curso_participante`: `costo_asignado`, `descuento`

⚠️ RIESGO: si alguien hace `Base.metadata.create_all()` en una BD vacía, estas
columnas NO se crearían. El bootstrap actual las crea vía ALTER en runtime, así
que funciona, pero es frágil. **Acción recomendada (post-RC):** añadir estas
columnas al modelo `Curso` y `CursoParticipante` para que `create_all` sea
idempotente y completo.

### C. Bugs de columna inexistente en SQL crudo (ya corregidos en RC-1)
Queries que asumían nombres de columna del esquema viejo:

| Archivo | Query | Columna rota | Real | Estado |
|---------|-------|--------------|------|--------|
| `reportes.py` | `empresas-top` | `organizaciones.nombre` | `razon_social` | ✅ corregido |
| `reportes.py` | `proximos-a-vencer` | `organizaciones.nombre` | `razon_social` | ✅ corregido |
| `public.py` | verificación pública | `organizaciones.nombre` | `razon_social` | ✅ corregido |

El auditor (`scripts/audit_sql_refs.py`) revisó TODAS las queries SQL crudas del
backend tras el fix y reportó **0 referencias a columnas inexistentes** (solo 1
falso-positivo benigno: `cursos.vigencia_meses`, columna que SÍ existe en BD).

### D. FKs reorientadas en Sprint A (la causa raíz de los incendios)
`cursos.cliente_id` y `participantes.cliente_id` apuntan ahora a
`organizaciones.id` (no a `clientes.id`). Requería alinear:

- `Curso.cliente_id = ForeignKey("organizaciones.id")` ✅
- `Participante.cliente_id = ForeignKey("organizaciones.id")` ✅
- `Cliente.organizacion_id` añadido al modelo ✅
- `Cliente.cursos` → primaryjoin vía `organizacion_id` ✅
- `Curso.cliente` → renombrado a `Curso.organizacion` (viewonly) ✅
- `get_current_user` (rama cliente) ahora devuelve `organizacion_id` ✅
- `crear_curso` usa `org_id` para `cursos.cliente_id`, `sub` para `creado_por` ✅

---

## ESTADO DE ALINEACIÓN
- ✅ Modelo ↔ BD: columnas coinciden (salvo las 6 omitidas en B, manejadas por ALTER).
- ✅ FKs: coherentes tras alineación Sprint A.
- ✅ SQL crudo: sin referencias a columnas inexistentes (auditado).
- ✅ Bootstrap: idempotente, arranca en BD vacía (verificado en sesión previa).

## HERRAMIENTAS DE REGRESIÓN (en `backend/scripts/`)
- `audit_schema.py` — modelo vs BD (columnas/tablas).
- `audit_sql_refs.py` — queries SQL crudas vs columnas BD.
Ejecutar tras cualquier ajuste de esquema:
  `cd backend && PYTHONPATH=. ./.venv/bin/python scripts/audit_schema.py`
  `cd backend && PYTHONPATH=. ./.venv/bin/python scripts/audit_sql_refs.py`

## PENDIENTE (post-RC, no bloquea release)
1. Añadir `precio_base`, `precio_promocional`, `grupo_id`, `curso_padre_id` al
   modelo `Curso` y `costo_asignado`, `descuento` a `CursoParticipante` para que
   `create_all` sea completo.
2. Opcional: declarar las tablas `contactos`, `grupos_curso`, `grupo_curso_items`,
   `tipos_curso` en el modelo (si se migran a ORM).
