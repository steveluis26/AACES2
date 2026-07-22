# AACES — Milestone 1 (v0.8) — CONGELADO

Fecha de congelación: 2026-07-21
Estado: motor principal funcional y verificado end-to-end (E2E local).

## Qué funciona (evidencia viva, flujo E2E completo HTTP 200)

- ✅ Login de cliente capacitador (`POST /auth/login`)
- ✅ Dashboard funcional (frontend navegable)
- ✅ Crear curso (`POST /cursos`, HTTP 201)
- ✅ Registrar participante (`POST /cursos/{id}/participantes`, HTTP 201)
- ✅ Acreditar participante (`POST /participantes/{id}/acreditar`, HTTP 200)
- ✅ Emitir constancia con PDF + QR + hash SHA-256 (`POST /constancias/emitir`, HTTP 200)
- ✅ Idempotencia: re-emitir el mismo curso_participante NO crea fila duplicada (`idempotente:true`, 1 fila en BD)
- ✅ Verificación pública (`GET /verificaciones/{codigo}`, HTTP 200) devuelve:
  - organización + RFC + nombre comercial
  - participante (nombre + empresa)
  - curso completo (nombre, código, fechas, duración, modalidad, empresa contratante, calificación, estado_acreditacion)
  - pdf_hash (SHA-256, 64 hex)
  - contador de verificaciones
- ✅ Página pública `/v/[codigo]` embellecida (participante, curso, duración, fechas, capacitador+RFID, folio, hash, "Emitido mediante AACES")
- ✅ Endpoint legacy `POST /constancias` convertido en alias de `emitir` (ya no genera basura)

## Cambios de esta iteración (Día 1-3)

1. **Día 1 — Verificación pública reparada.** Causa raíz: la verificación resolvía
   participante/curso vía `codigo_validacion` (NULL en 59/65 filas). Se agregó FK real
   `documentos_emitidos.curso_participante_id` → `curso_participante.id` y el servicio
   `verify()` resuelve por FK con fallback. Se extendió `VerificacionPublicResponse`
   con rfc, folio, nombre_comercial, org_estado, org_ciudad.
2. **Día 2 — Idempotencia.** `constancias_service.emitir` busca doc existente por
   `curso_participante_id` (estatus=emitido) y lo regresa sin insertar. Nunca dos filas.
3. **Día 3 — Endpoint legacy.** `POST /constancias` ya delega a `emitir` (PDF+QR+hash).

## Harness E2E
- Carpeta `tests/e2e/` con scripts independientes + `flujo_completo.sh`.
- Un solo comando: `./tests/e2e/flujo_completo.sh` (requiere backend en :8000).
- Limpieza: `./tests/e2e/cleanup.sh`.

## No cubierto aún (fuera de este milestone, por diseño)
- Stripe / domiciliación (diferido: no es el activo actual).
- Registro Maestro de Participantes (pax_id permanente, historial, renovaciones).
- Prueba con agencia capacitadora real (observación UX, no API).

## Siguiente fase sugerida (post-Milestone 1)
Participante como activo continuo: Perfil → Historial → QR permanente → Renovaciones.
