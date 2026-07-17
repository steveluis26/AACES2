# Performance Baseline v1

**Version:** 1.0
**Release:** v0.9
**Última actualización:** 2026-07-16
**Propietario:** Equipo Backend

## Objetivo

Establecer las métricas de rendimiento iniciales del Motor Documental. Este documento no define objetivos de optimización; su propósito es registrar la línea base contra la cual medir regresiones en sprints futuros.

## Condiciones de prueba

- Base de datos: PostgreSQL 15 (Render)
- Entorno: instancia libre, 1 vCPU, 512 MB RAM
- Datos: ~1000 documentos emitidos, ~5000 verificaciones
- Medición: percentil 95 (p95) sobre 10 requests consecutivos
- Herramienta: `EXPLAIN ANALYZE` + `httpx` desde entorno local
- Conexión: red pública (latencia aproximada 50-100ms incluida en p95)

## Endpoints

### CRUD operativo

| Endpoint | p95 esperado | p95 registrado | Notas |
|----------|-------------|----------------|-------|
| `GET /api/v1/constancias` (paginado) | < 300ms | | |
| `GET /api/v1/constancias/{id}` | < 200ms | | |
| `POST /api/v1/constancias` (emitir) | < 500ms | | Incluye generación de PDF |
| `POST /api/v1/constancias/{id}/cancelar` | < 200ms | | |
| `GET /api/v1/dashboard` | < 500ms | | 4 queries agregadas |
| `GET /api/v1/verificar/{codigo}` | < 200ms | | |

### Reportes (< 1000 documentos)

| Endpoint | p95 esperado | p95 registrado | Notas |
|----------|-------------|----------------|-------|
| `GET /api/v1/reportes/constancias-por-periodo` | < 1s | | |
| `GET /api/v1/reportes/tiempo-promedio-emision` | < 1s | | |
| `GET /api/v1/reportes/documentos-no-verificados` | < 1s | | |
| `GET /api/v1/reportes/cursos-top` | < 1s | | |
| `GET /api/v1/reportes/empresas-top` | < 1s | | |
| `GET /api/v1/reportes/proximos-a-vencer` | < 1s | | |

### Descarga de documentos

| Endpoint | p95 esperado | p95 registrado | Notas |
|----------|-------------|----------------|-------|
| `GET /api/v1/constancias/{id}/pdf` | < 1s | | Archivo leído de disco |

## Queries lentas

Registrar aquí cualquier query que en `EXPLAIN ANALYZE` muestre:

- Sequential scan en tablas > 10,000 registros (índice faltante)
- Hash Join sin índice (costo > 1000)
- Tiempo de ejecución > 200ms en CRUD o > 500ms en reportes

| Query | Tiempo | Plan | Acción |
|-------|--------|------|--------|
| | | | |

## Historial de cambios

| Fecha | Versión baseline | Entorno | Notas |
|------|-----------------|---------|-------|
| 2026-07-16 | v1 | Render (free) | Baseline inicial |
