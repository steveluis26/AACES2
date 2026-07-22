# PRODUCT_VISION

Visión de producto de AACES. Documento de negocio, NO técnico.
Sirve para que Sprint B (Registro Maestro de Participantes) y los siguientes
tengan una dirección clara antes de escribir código.

---

## Qué es AACES

AACES es un sistema operativo para **agentes capacitadores** (organizaciones que
imparten cursos de capacitación y expiden constancias con validez oficial vía QR).

El cliente de AACES NO es el participante del curso.
El cliente de AACES es la **organización capacitadora** que paga la suscripción.

Esto es la regla #1 del producto: todo el dominio se modela en la organización
capacitadora, nunca en un usuario individual suelto.

---

## Jerarquía del dominio (ya establecida en Sprint A)

```
Organización (agente capacitador)
      │
      ├── Usuarios      (quienes operan el sistema de la org)
      ├── Clientes      (cuenta operativa que crea cursos/constancias)
      ├── Cursos        (impartidos por la org)
      ├── Participantes (personas que toman los cursos)
      └── Documentos    (constancias emitidas, con QR + PDF + hash)
```

---

## ¿Qué es un Participante?

Una **persona física** que tomó uno o más cursos impartidos por una organización.

Propiedades del participante (datos que lo describen):
- Nombre completo.
- CURP (identidad oficial en México).
- RFC (si aplica).
- Correo electrónico.
- Teléfono (obligatorio desde Sprint A — base para WhatsApp/renovaciones).
- Ciudad / estado.

El participante **NO es cliente de AACES**. Es el alumno de la organización
capacitadora. AACES nunca le cobra al participante; le cobra a la organización.

---

## ¿Qué es el Registro Maestro de Participantes? (Sprint B1)

Una **base única y persistente** de participantes dentro de una organización,
independiente de cuántos cursos hayan tomado.

Hoy (Sprint A) un participante se crea cada vez que se registra en un curso.
Eso genera duplicados: la misma persona en 3 cursos = 3 registros distintos.

El Registro Maestro resuelve eso:
- Un participante = UNA identidad (pax_id).
- Sus cursos y constancias cuelgan de esa identidad (historial).
- El perfil del participante muestra todo su recorrido con la organización.

Valor de negocio: la organización ya no pierde la relación con alguien que
capacitó. Puede recontactarlo para renovaciones, nuevos cursos, certificaciones.

---

## ¿Qué significa pax_id?

Identificador único y estable del participante DENTRO de la organización.

- Es la "clave primaria" del participante en el Registro Maestro.
- No cambia aunque el participante tome 10 cursos.
- Permite dedupicar: si el mismo CURP/teléfono aparece de nuevo, se enlaza
  al pax_id existente en lugar de crear un participante nuevo.

En Sprint B1 el pax_id es interno. En B2/B3 se vuelve visible (Credencial Digital).

---

## ¿Qué representa la Credencial Digital? (Sprint B1, al final)

Un documento emitido por la organización que identifica al participante dentro
del ecosistema AACES, con un **QR permanente** que resuelve a su perfil público.

No es una constancia de un curso específico: es la identidad del participante
ante la organización. El QR de la credencial apunta al perfil del participante,
no a un documento efímero.

Diferencia clave:
- **Constancia** = un curso terminado (tiene vigencia, expira).
- **Credencial Digital** = la identidad del participante (no expira, es permanente).

---

## ¿Qué información NUNCA debe perderse?

Esta es la regla de integridad del producto:

1. **La relación participante–organización.** Un participante siempre pertenece
   a la organización que lo capacitó. Nunca se "comparte" entre organizaciones
   (el aislamiento multi-tenant lo garantiza).
2. **El historial de constancias.** Cada documento emitido es inmutable: su
   hash SHA-256, folio, fechas de vigencia y código de verificación deben
   Conservarse aunque la constancia expire o se revoque.
3. **El código de verificación (QR).** Es la prueba pública de autenticidad.
   Debe ser consultable aunque el participante ya no esté activo.
4. **El pax_id.** Si se pierde, se pierde el historial acumulado del participante.

---

## ¿Qué pertenece a la ORGANIZACIÓN y qué al PARTICIPANTE?

| Pertenece a la ORGANIZACIÓN | Pertenece al PARTICIPANTE |
|---|---|
| Cursos que imparte | Su nombre, CURP, RFC, teléfono |
| Plantillas de constancia | Sus constancias (emitidas por la org) |
| Logos y marca | Su historial de cursos tomados |
| Suscripción y plan | Su pax_id |
| Métricas y dashboards | Su Credencial Digital |
| Reglas de vigencia | |

Regla: los **datos operativos** (cursos, plantillas, métricas) son de la org.
Los **datos personales** (identidad, historial) son del participante, pero
residen bajo la org que los generó. AACES nunca mueve un participante de una
org a otra.

---

## Roadmap de producto (visión)

- **v0.4.0 — Core Operativo** (Sprint A, DONE): dominio multiempresa estable,
  constancias con QR/PDF/hash/folio/vigencias, emisión idempotente, multiusuario.
- **v0.5.0 — Registro Maestro** (Sprint B1): pax_id, historial, perfil,
  Credencial Digital, QR permanente.
- **v0.5.5 — CRM** (Sprint B2): empresa, puesto, etiquetas, contacto, notas.
- **v0.6.0 — Renovaciones** (Sprint B3/C): por-vencer, WhatsApp, ingresos
  recuperables, dashboard.
- **v0.7.0 — Stripe** (Sprint D): cobros a la organización.
- **v0.8.0 — Marketplace** (Sprint E).

Cada versión entrega valor por sí sola. No se espera a tener todo para liberar.

---

## Decisiones de política (beta vs facturación)

**Beta (hoy):**
Registro → Trial activo automáticamente → Organización activa → Puede trabajar
inmediatamente.

**Cuando exista facturación (Stripe):**
Registro → Trial 14 días → Expira → Stripe → Pago → Activo.

No se introduce complejidad de pagos antes de tener clientes reales.
