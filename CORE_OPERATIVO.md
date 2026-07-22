# Sprint A — Core Operativo

**Estado:** ✔ Certificado
**Fecha de cierre:** 2026-07-22
**Modelo de dominio:** Organización capacitadora dueña de los datos; el usuario solo ejecuta acciones.

---

## Flujo validado (E2E, evidencia viva)

| Paso | Endpoint | Resultado |
|------|----------|----------|
| Login | `POST /api/v1/auth/login` | ✅ 200 — token con contrato unificado |
| Crear curso | `POST /api/v1/cursos` | ✅ 201 — `duracion_validacion` obligatorio |
| Registrar participante | `POST /api/v1/cursos/:id/participantes` | ✅ 201 — teléfono obligatorio |
| Acreditar | `POST /api/v1/participantes/:id/acreditar` | ✅ 200 — `fecha_acreditacion = NOW()` |
| Emitir constancia | `POST /api/v1/constancias/emitir` | ✅ 200 — PDF + QR + hash + folio + vigencia |
| Re-emisión | `POST /api/v1/constancias/emitir` | ✅ 200 — `idempotente: true`, mismo `codigo_validacion` |
| Verificar (público) | `GET /api/v1/verificaciones/:codigo` | ✅ 200 — `valida: true`, org/RFC/participante/curso/horas/hash |
| Integridad BD | `documentos_emitidos` | ✅ 1 fila por curso-participante (sin duplicados) |

**Checks de reglas de negocio (BD):**
- ✅ `folio` secuencial (`AAC-2026-00005`, `AAC-2026-00006`) poblado.
- ✅ `curso_participante.fecha_inicio_vigencia` y `fecha_expiracion` derivadas de `duracion_validacion` (NO NULL).
- ✅ `curso_participante.fecha_acreditacion` con trazabilidad (NO NULL).
- ✅ `documentos_emitidos.pdf_hash` SHA-256 (64 chars).

**Test multiusuario (certifica el dominio multiempresa):**
- Admin (JWT A) crea `Seguridad Industrial MULTI`.
- Operador (JWT B, **misma `organizacion_id`**) hace `GET /cursos` y **VE el curso del Admin** (31 cursos visibles, todos de la org).
- Sin compartir JWT, sin hacks, sin cambiar consultas.

---

## Cambios estructurales (lo que realmente cerró el Core)

1. **Modelo de tenencia:** `cursos.cliente_id` y `participantes.cliente_id` reorientados
   de `clientes(id)` → `organizaciones(id)`. La organización es el dueño de los datos.
   `creado_por` conserva el `sub` (usuario que ejecutó).
2. **Columnas nuevas:** `cursos.organizacion_id`, `participantes.organizacion_id`,
   `curso_participante.fecha_acreditacion`.
3. **Filtros por organización:** endpoints de cursos/participantes resuelven `cid = org_id`
   del token (no `sub`).
4. **Contrato de token unificado (`build_token`):** ambas ramas (`usuarios`/`clientes`)
   producen SIEMPRE `{sub, role, org_id, org_name, permissions, source}`.
   Elimina la categoría de bugs "¿este token viene de clientes o de usuarios?".
5. **Backfill histórico:** 24/24 cursos de la org demo + 7 participantes migrados a
   `organizacion_id` desde el creador. 0 datos históricos rotos.

---

## Regla post-cierre

> **NO modificar el Core Operativo (auth/login, cursos, participantes, acreditación,
> emisión de constancias, verificación, modelo de tenencia) salvo corrección de bugs
> críticos.** El Core es ahora una plataforma estable.

## Siguiente fase (diferenciadores de negocio)

- **Sprint B:** Registro Maestro de Participantes (historial permanente vía `pax_id`, Credencial Digital AACES).
- **Sprint C:** Renovaciones, alertas y recuperación de ingresos (tablero comercial).
- **Sprint D:** Cobros y suscripciones (Stripe).
- **Sprint E:** Marketplace y crecimiento.

El valor de AACES ya no está en emitir constancias: está en todo lo que ocurre después.
