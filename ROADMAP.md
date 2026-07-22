# AACES — Roadmap de Producto (versión estabilizada)

Fecha de estabilización: 2026-07-21
Base técnica congelada: `MILESTONE_1.md` (AACES v0.8 — motor principal verificado E2E).
Este documento NO se modifica salvo hallazgo crítico nuevo. Las decisiones aquí
están respaldadas por tres auditorías realizadas el 2026-07-21:
  - Auditoría funcional: flujo Login→Curso→Participante→Acreditar→Emitir→PDF/QR→Verificar, HTTP 200 + BD consistente.
  - Auditoría de datos: `SELECT` de conteo sobre curso_participante / organizaciones / participantes / documentos / cursos.
  - Auditoría de multitenancy: revisión de endpoints de cursos, participantes, constancias, auth.

---

## Principios del producto

> **AACES no es un generador de constancias. AACES es un sistema operativo para capacitadoras.**

1. Toda la información pertenece a una **organización**, nunca a un usuario individual.
2. El participante tiene un **historial permanente** (identidad `pax_id`, ya existente al 100%).
3. Las constancias son **consecuencia del proceso**, no el producto.
4. Las **renovaciones** generan el mayor valor económico para la capacitadora.
5. Cada funcionalidad nueva debe **reducir trabajo administrativo** o **generar nuevas ventas**
   para la capacitadora. Si una idea no hace ninguna de las dos, no entra al roadmap.

**Principio #1 (filtro de diseño):** Ninguna funcionalidad nueva se diseñará pensando en un
usuario individual. Todo se modela pensando en una **organización capacitadora**. Esto evita
regresar al error de `cliente_id = user.sub` detectado en la auditoría de multitenancy.

---

## Hallazgos de las auditorías (por qué este roadmap es así)

- **Cuello de botella real = ciclo de vida de la capacitación no se cierra**, no el frontend.
  `curso_participante.fecha_inicio_vigencia` = 0/66, `fecha_expiracion` = 5/66,
  `documentos_emitidos.folio` = 1/21. Sin vigencias no hay renovaciones.
- **`pax_id` existe en 20/20 participantes** → el Registro Maestro ya está sembrado; se aprovecha.
- **65% de participantes sin teléfono** (13/20) → el CRM de renovaciones nace muerto sin corrección.
- **Multitenancy hoy filtra por `cliente_id = user.sub`** (no por org) en cursos/participantes/
  dashboard, mientras constancias/documentos usan `organizacion_id`. Inconsistencia de naming +
  aislamiento incorrecto entre colegas de la misma org. No hay fuga cross-org hoy, pero el modelo
  está mal planteado y es frágil para nuevos endpoints.
- **`cursos.duracion_validacion` existe (0/31 relleno)** → la vigencia se deriva:
  `fecha_emision + duracion_validacion`. Campo listo, falta poblarlo y usar la lógica.
- **`organizaciones` no tiene `registro_stps` ni `logo`** → STPS se maneja como estado nullable
  ("Registrado: DC-5 XXXXX" / "No registrado"), sin integración con STPS. No bloquea el roadmap.
- **`storage_provider` ya existe en `documentos_emitidos`** → esquema listo para R2/S3; el cambio
  de `/tmp` a objeto storage es de despliegue, no de modelo.

---

## Sprint A — Core Operativo

Objetivo: cerrar el ciclo de vida y corregir el modelo de dominio. Para el cliente es UN flujo,
no cinco módulos.

### A1. Flujo operativo (ya funcional, pulir UX frontend)
- Crear curso → Registrar participantes → Acreditar → Emitir constancia → Verificar.
- El backend ya emite PDF+QR+hash; el Sprint A deja la UI del capacitador sin fricción.

### A2. Reglas de negocio obligatorias (cierran el ciclo de vida)
1. **Al crear curso:** `duracion_horas`, `duracion_validacion` y vigencia **obligatorios** (no NULL).
   Si un curso no vence: opciones 12 / 24 / 36 meses / sin vencimiento. Esto obliga a poblar
   `duracion_validacion`.
2. **Al acreditar:** `estado_acreditacion = true` y `fecha_acreditacion = NOW()` se setean en el
   momento de aprobar (no se espera a emitir).
3. **Al emitir (toda la magia automática, sin campos vacíos):**
   - `fecha_inicio_vigencia = fecha_emision`
   - `fecha_expiracion = fecha_emision + duracion_validacion`
   - `folio = generar()` (secuencial por org)
   - `QR`, `PDF`, `hash` se generan.
   - Nunca debe existir un documento emitido con campos vacíos.
4. **Teléfono obligatorio** para nuevos participantes. Correo/empresa/cargo opcionales.
   El dinero está en Renovar → WhatsApp → Nueva venta; sin teléfono el Sprint C no arranca.

### A3. Dominio multiempresa (refactorización del modelo de datos, no solo seguridad)
Cambio de pregunta: de *"¿qué cursos creó este usuario?"* a *"¿qué cursos pertenecen a esta organización?"*.

Reglas:
- Toda la información pertenece a una **Organización**, nunca a un usuario.
- Todas las consultas filtran por `org_id` (del token), no por `user.sub`.
- Todos los registros nuevos guardan `organizacion_id`.
- Los usuarios son **personas que trabajan dentro de una organización**.
- Dos usuarios de la misma organización ven **exactamente la misma información** (según permisos).

Acciones concretas en A3:
- Unificar semánticamente `cliente_id` → `organizacion_id` en cursos/participantes/dashboard.
- Al crear curso/participante, `organizacion_id = user_data["org_id"]` (no `sub`).
- Nuevos endpoints usan `org_id` siempre.
- (Opcional, post-A3) helper central `require_tenant` que inyecte `org_id` y lo imponga.

---

## Sprint B — Registro Maestro de Participantes

La entidad más importante de AACES. Aprovecha `pax_id` existente.

Contiene por participante:
- Perfil (nombre, empresa, puesto, teléfono, CURP si aplica).
- Historial (cursos tomados con la org).
- Constancias emitidas.
- Vigencias (vigente / por vencer / vencido).
- **Credencial Digital AACES** (vista pública vía `pax_id`, NO vía CURP/teléfono/correo):
  al escanear el QR se ve nombre, cursos con esa org, vigencias, constancias, estado.
  No expone datos sensibles.
- Renovaciones asociadas.

El QR deja de ser "el producto" y pasa a ser una vista pública del Registro Maestro.

---

## Sprint C — Renovaciones (tablero comercial, no solo lista)

Objetivo: convertir la herramienta administrativa en herramienta comercial.

Widget central — **Ingresos recuperables**:
```
Renovaciones
  42 personas por vencer
  Ingreso potencial: $138,000 MXN
  ──────────────
  • 17 vencen este mes
  • 13 en 30 días
  • 12 en 60 días
```
Luego, por empresa:
```
Empresa ABC — 15 personas — [Renovar todo] [Enviar WhatsApp]
Juan Pérez — Montacargas — Vence en 17 días — ☎ WhatsApp · ✉ Correo
```
Esto hace que la capacitadora **venda nuevamente**. Es el módulo de mayor valor.

Depende de A2/A3: sin vigencias pobladas y sin teléfono, no existe.

---

## Sprint D — Facturación (Stripe)

Sin cambios respecto a lo acordado. Paso 3 = los clientes de la capacitadora pagan al USUARIO
domiciliado (NO Mercado Pago). Se construye DESPUÉS de tener capacitadoras operando diariamente
en AACES, no antes. Cobrar requiere clientes usando la plataforma.

---

## Sprint E — Marketplace

Sin cambios. No se construye inmediatamente.
Cuando las capacitadoras trabajen todos los días dentro de AACES, el Marketplace tendrá sentido
porque ya habrá oferta (cursos cerca de una ciudad). Los cursos guardan `ciudad` como texto;
si se requiere "las más cercanas" habrá que añadir geocodificación (lat/lng) en fase de diseño.

---

## Fuera de alcance (explotación del pivot, no reconstrucción)
- Autenticación, navegación, layouts, middleware: congelados (Milestone 1).
- QR de constancias, generación de PDF, sistema de verificación: congelados (Milestone 1).
- Plantillas y Constancias: validar y corregir lo roto, no reconstruir.
- STPS: estado nullable ("Registrado / No registrado"), sin integración automática.

## Orden de ejecución
A → B → C → D → E. Cada sprint se cierra con evidencia viva (`./tests/e2e/flujo_completo.sh`
más prueba del módulo nuevo). No se rediseña la visión salvo hallazgo crítico nuevo.
