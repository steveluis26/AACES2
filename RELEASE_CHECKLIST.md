# RELEASE_CHECKLIST

Criterio de calidad re-ejecutable. Cada vez que vayas a liberar una versión
(merge a main + tag + push), recorre ESTA lista. Si algo falla, NO hagas push.

Regla de oro: el backend debe arrancar y funcionar en una BD COMPLETAMENTE
VACÍA (simula el peor escenario: instalación limpia / Neon nuevo).

---

## Sprint A — Core Operativo (v0.4.0)

### Arranque / Infra
- [ ] `health` responde `{"status":"healthy"}` tras arrancar backend fresco.
- [ ] Backend arranca sobre BD VACÍA (drop+create) sin errores de bootstrap.
- [ ] `ensure_schema()` es idempotente (correr 2+ veces no rompe).
- [ ] `schema_version` se crea y `check_schema_health` reporta `status=OK`.
- [ ] Logs de bootstrap sin `UndefinedTable` / `InFailedSQLTransaction` / `ProgrammingError`.

### Flujo funcional (E2E local)
- [ ] Login (HTTP 200, JWT con `org_id`).
- [ ] Crear curso (HTTP 201, `duracion_validacion` obligatorio).
- [ ] Registrar participante (HTTP 201, teléfono obligatorio).
- [ ] Acreditar (HTTP 200, `fecha_acreditacion` poblada).
- [ ] Emitir constancia (HTTP 200, PDF + QR + hash SHA-256 + folio secuencial).
- [ ] Re-emitir (HTTP 200, `idempotente: true`, MISMO `codigo_validacion`).
- [ ] Verificación pública por QR (HTTP 200, `valida: true`, org/RFC/participante/curso/horas/hash).
- [ ] Integridad BD: 1 fila `documentos_emitidos` por curso-participante (sin duplicados).

### Reglas de negocio (BD)
- [ ] `folio` poblado y secuencial (`AAC-YYYY-NNNNN`).
- [ ] `curso_participante.fecha_inicio_vigencia` y `fecha_expiracion` derivadas (NO NULL).
- [ ] `curso_participante.fecha_acreditacion` NO NULL.
- [ ] `documentos_emitidos.pdf_hash` SHA-256 (64 chars).

### Multiempresa (certifica dominio)
- [ ] Admin (JWT A) crea curso → Operador (JWT B, MISMA `organizacion_id`) lo ve en `GET /cursos`.
- [ ] Dos organizaciones distintas NO comparten cursos/participantes.
- [ ] `cursos.cliente_id` y `participantes.cliente_id` referencian `organizaciones(id)` (no usuarios).

### Cierre
- [ ] `cleanup.sh` borra datos de prueba.
- [ ] Logs del backend limpios tras el flujo.
- [ ] `git status` limpio (nada sin commitear).
- [ ] Tag de versión creado (ej. `v0.4.0-rc1` antes del merge).
- [ ] Push AUTORIZADO solo tras aprobar todo lo anterior.

---

## Versionado por hitos (disciplina SaaS)
- `v0.4.0` — Sprint A: Core Operativo multi-tenant estable.
- `v0.5.0` — Sprint B1: Registro Maestro de Participantes (pax_id, historial, Credencial Digital).
- `v0.5.5` — Sprint B2: CRM (empresa, puesto, teléfono, correo, ciudad, etiquetas, contacto).
- `v0.6.0` — Sprint B3/C: Renovaciones (por-vencer, WhatsApp, ingresos recuperables, dashboard).
- `v0.7.0` — Sprint D: Stripe (cobros / suscripciones).
- `v0.8.0` — Sprint E: Marketplace.

Cada versión = una funcionalidad que entrega valor por sí sola. No esperar
meses para liberar todo junto.
