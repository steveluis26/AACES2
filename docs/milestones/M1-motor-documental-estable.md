# M1 — Motor Documental Estable

- **Fecha:** 2026-07-16
- **Commit:** 110ef13 (Sprint 5.1 + fixes)
- **Acceptance:** Acceptance v1 — 18/18 pasos aprobados (27 steps API)
- **Performance baseline:** `docs/testing/performance-baseline-v1.md`

## Objetivo

Estabilizar el motor de emisión, verificación y cancelación de constancias digitales, validando el flujo completo de extremo a extremo mediante un Acceptance Test automatizado que cubre los 18 criterios de la release v0.9.0.

## Alcance

- Emisión de constancias con folio y código de validación único
- Verificación pública de constancias por código de validación
- Cancelación y reemisión de constancias con trazabilidad (timeline)
- Búsqueda de constancias por folio, UUID, y texto parcial (ILIKE)
- Reportes operativos: constancias por período, tiempo promedio de emisión, documentos no verificados, cursos top, empresas top, próximos a vencer
- Dashboard de KPIs para clientes: total cursos, participantes, acreditados, constancias emitidas
- Bootstrap modularizado en 5 fases independientes (schema, indexes, seed, version, health)
- Degradación graceful ante tablas faltantes en dashboard y constancias
- Discriminación de errores por SQLSTATE (42P01, 23505, 23503)

## Evidencia

- **Acceptance v1:** 18/18 pasos — `scripts/acceptance_api.py`
- **Reportes operativos:** 6 endpoints implementados en `reportes.py`
- **Bootstrap modular:** 5 fases en `app/bootstrap/` (schema, indexes, seed, version, health)
- **ADRs aplicados:**
  - ADR-015: Query/Command Objects para >3 parámetros
  - ADR-016: DocumentCapabilities como objeto anidado
  - ADR-017: ViewModels en frontend, no DTOs
  - ADR-018: DomainError en services, no HTTP
  - ADR-019: SQL complejo en Repository
- **Bitácora de ejecución:** `docs/testing/evidence/v0.9.0/bitacora-acceptance-v1.json`

## Fuera del alcance

- Dashboard Operativo (Sprint 5.2) — no bloquea salida a producción
- Audit Events — pendiente para v0.9.1
- Reportes avanzados (exportación, gráficas interactivas)
- IA / ML
- Event Bus / Kafka / Redis Streams
- CQRS / Event Sourcing
- GraphQL
- Microservicios
- Integraciones externas (Mercado Pago, facturación electrónica)
- Cache distribuida
- Despliegue multi-región

## Riesgos conocidos

- **asyncpg savepoints:** Los nested transactions (`begin_nested()`) aíslan errores individuales en bootstrap, pero asyncpg aborta toda la transacción ante ciertos errores. Cada fase bootstrap usa `engine.connect()` + `commit()` explícito para mitigarlo.
- **Schema mismatch V004 vs bootstrap:** `V004__document_engine.sql` usa esquema simplificado vs. bootstrap (ej. `suscripciones.activa BOOLEAN` vs `suscripciones.estatus VARCHAR`). Requieren alineación antes de aplicar migraciones en producción con datos reales.
- **Multi-schema owner mix:** Tablas legacy (`clientes`, `cursos`) con owner `aaces_admin`; tablas nuevas (`organizaciones`, `usuarios`) con owner `postgres`. Pueden causar errores de permisos al hacer ALTER entre schemas.
- **Passlib/bcrypt compat:** `passlib==1.7.4` requiere `bcrypt<4.1`. Pinned en `requirements.txt`.
- **Sin staging environment:** Performance baseline medido contra BD local. Recomendable restaurar dump de producción para benchmark realista.
