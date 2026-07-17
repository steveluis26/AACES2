# Acceptance Test v1

**Version:** 1.0
**Release:** v0.9
**Estado:** Aprobado
**Última actualización:** 2026-07-16
**Propietario:** Equipo Backend

## Objetivo

Validar que el Motor Documental (Sprints 1-4C + Batches 0-2) cumple el flujo completo de negocio: preparar una capacitación, emitir constancias, verificarlas públicamente, gestionar su ciclo de vida y consultar reportes operativos.

Este test es la definición de "el sistema funciona" para la release v0.9. La UI puede cambiar veinte veces; el acceptance cambia solo cuando cambia el negocio.

## Precondiciones

- Base de datos con esquema V004 aplicado (`schema_version` = 4).
- Sesión de administrador activa (JWT válido con `organizacion_id`).
- Almacenamiento local configurado (`UPLOAD_DIR`, `STORAGE_DIR`).
- Sin datos previos de constancias en la organización (KPIs medibles desde cero).

## Dataset esperado

Durante la ejecución del test se crearán:

- 1 organización
- 1 curso
- 1 participante
- 1 acreditación
- 2 documentos (1 cancelado + 1 reemitido)
- 1 verificación pública

## Flujo de negocio

### 1. Preparación

| # | Paso | Criterio |
|---|------|----------|
| 1.1 | Crear un curso con nombre, costo y duración | `201 Created`, curso visible en listado |
| 1.2 | Registrar un participante con datos válidos (nombre, CURP, correo) | `201 Created`, participante asignado al curso |
| 1.3 | Acreditar al participante con calificación >= 70 | Estado del participante cambia a `acreditado`; `fecha_acreditacion` registrada |
| 1.4 | Verificar KPIs del dashboard | Dashboard: `total_acreditados` = 1, `pendientes["emitir"]` = 1 |

### 2. Emisión

| # | Paso | Criterio |
|---|------|----------|
| 2.1 | Emitir constancia para el participante acreditado | `201 Created`, UUID de documento devuelto |
| 2.2 | Verificar que la constancia tenga `folio` asignado | Folio no nulo, formato alfanumérico |
| 2.3 | Descargar el PDF de la constancia | Archivo PDF válido (header `%PDF`), `Content-Type: application/pdf` |
| 2.4 | Verificar que el QR generado sea un URL válido de verificación | QR decodificable; URL apunta a `/verificar/<codigo>` |
| 2.5 | Verificar KPIs actualizados | Dashboard: `constancias_emitidas` = 1, `pendientes["emitir"]` = 0 |

### 3. Verificación

| # | Paso | Criterio |
|---|------|----------|
| 3.1 | Consultar verificación pública con el código del documento | `200 OK`, datos: tipo, `estatus` = `emitido`, fecha, organización |
| 3.2 | Consultar el timeline del documento | Timeline contiene eventos en orden correcto |
| 3.3 | Verificar que se haya registrado en `verificaciones` | Tabla `verificaciones` tiene una fila con `resultado` = `VALIDA`, `tipo` = `QR` |

### 4. Gestión

| # | Paso | Criterio |
|---|------|----------|
| 4.1 | Cancelar la constancia emitida | `200 OK`, estatus cambia a `cancelado` |
| 4.2 | Verificar orden del timeline | Timeline: 1. Emitido → 2. Cancelado |
| 4.3 | Verificación pública refleja cancelación | GET `/verificar/<codigo>` → `estatus` = `cancelado` |
| 4.4 | Reemitir la constancia | `200 OK`, nuevo documento con `estatus` = `emitido`, `codigo_validacion` distinto |
| 4.5 | Verificar orden del timeline tras reemisión | Timeline: 1. Emitido → 2. Cancelado → 3. Reemitido |
| 4.6 | Buscar constancias por folio | Resultados filtrados, 1 coincidencia |
| 4.7 | Buscar constancias por UUID exacto | Resultados filtrados, 1 coincidencia |
| 4.8 | Buscar constancias por texto parcial (ILIKE) | Resultados incluyen coincidencias parciales |

### 5. Reportes

| # | Reporte | Criterio |
|---|---------|----------|
| 5.1 | Constancias emitidas por período | Endpoint devuelve `{ período, total }`, total >= 1 |
| 5.2 | Tiempo promedio acreditación → emisión | Endpoint devuelve tiempo promedio en días/horas, valor > 0 |
| 5.3 | Documentos nunca verificados | Endpoint devuelve documentos con 0 verificaciones |
| 5.4 | Cursos por volumen de certificación | Endpoint devuelve top N ordenado descendente |
| 5.5 | Empresas por volumen de certificación | Endpoint devuelve top N ordenado descendente |
| 5.6 | Constancias próximas a vencer | Endpoint devuelve documentos con `fecha_expiracion` en los próximos 30 días |

## Criterios de aceptación

1. **Flujo completo:** todos los pasos 1-4 ejecutados secuencialmente sin errores. Si un paso falla, el test se detiene.
2. **Reportes correctos:** todos los reportes del flujo 5 devuelven datos consistentes con el flujo ejecutado.
3. **Consistencia entre módulos:** los mismos datos deben coincidir en Dashboard, Gestión de Constancias, Detalle, Verificación Pública y Reportes.

   | Módulo | Dato | Valor esperado |
   |--------|------|---------------|
   | Dashboard | `constancias_emitidas` | 2 |
   | Reportes | Constancias por período | 2 |
   | Listado | Total registros | 2 |
   | Verificación Pública | Documentos válidos | 2 |

4. **Sin registros huérfanos:**
   - `DocumentoEmitido.organizacion_id` siempre referencia `Organizaciones`
   - `DocumentoEmitido.emitido_por` referencia `Usuarios`
   - Cada `DocumentoEmitido` tiene un `CursoParticipante` acreditado asociado
   - `Verificacion.documento_id` siempre referencia `DocumentoEmitido`

## Resultado esperado

Al finalizar el test:

- 1 curso creado con 1 participante acreditado
- 2 documentos: 1 cancelado + 1 reemitido
- El QR de la constancia redirige a verificación pública funcional
- Timeline: Emitido → Cancelado → Reemitido
- 0 registros huérfanos en `DocumentoEmitido`, `Verificacion`
- 6 reportes devuelven datos correctos y consistentes
- Dashboard replica exactamente los mismos valores

## Matriz de trazabilidad

| Requisito | Endpoint | Pantalla |
|-----------|----------|----------|
| Crear curso | `POST /api/v1/cursos` | Gestión de Cursos |
| Registrar participante | `POST /api/v1/cursos/{id}/participantes` | Gestión de Cursos |
| Acreditar | `POST /api/v1/participantes/{id}/acreditar` | Gestión de Cursos |
| Emitir constancia | `POST /api/v1/constancias` | Gestión de Constancias |
| Descargar PDF | `GET /api/v1/constancias/{id}/pdf` | Detalle de Constancia |
| Verificar QR | `GET /api/v1/verificar/{codigo}` | Verificación Pública |
| Timeline | `GET /api/v1/constancias/{id}/timeline` | Detalle de Constancia |
| Cancelar | `POST /api/v1/constancias/{id}/cancelar` | Detalle de Constancia |
| Reemitir | `POST /api/v1/constancias/{id}/reemitir` | Detalle de Constancia |
| Buscar constancias | `GET /api/v1/constancias` | Gestión de Constancias |
| Dashboard KPIs | `GET /api/v1/dashboard` | Dashboard |
| Reporte: constancias por período | `GET /api/v1/reportes/constancias-por-periodo` | Dashboard |
| Reporte: tiempo promedio emisión | `GET /api/v1/reportes/tiempo-promedio-emision` | Dashboard |
| Reporte: documentos no verificados | `GET /api/v1/reportes/documentos-no-verificados` | Dashboard |
| Reporte: cursos top | `GET /api/v1/reportes/cursos-top` | Dashboard |
| Reporte: empresas top | `GET /api/v1/reportes/empresas-top` | Dashboard |
| Reporte: próximos a vencer | `GET /api/v1/reportes/proximos-a-vencer` | Dashboard |
