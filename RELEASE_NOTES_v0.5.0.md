# Release Notes — v0.5.0 (Sprint B: Gestión de Cursos y Demo Funcional)

**Fecha de cierre propuesta:** 2026-07-24
**Branch:** `feature/rc1-tenant-truth`
**Tag:** `v0.5.0` (al hacer merge a `main`)
**Estado:** En revisión visual. Sin merge a `main` aún.

---

## 1. Objetivo del release

Entregar un **demo funcional y una gestión real de cursos** que recorran el flujo
de valor de AACES de punta a punta, con UX coherente y cableada al contrato real
del backend (no a endpoints imaginados):

> curso → participante → acreditación → constancia (PDF + QR + folio + hash) →
> verificación pública por código.

El backend ya certificaba este flujo (Sprint A / Core Operativo, `CORE_OPERATIVO.md`).
El gap real era **frontend desconectado del backend y con pantallas amontonadas**.
Este release lo resuelve sin tocar auth/nav/core (regla de oro del Core).

---

## 2. Cambios arquitectónicos

### Servicios (backend, ya estables en Sprint A — se respetan)
- `CursoService` — única fuente de verdad de cursos.
- `ParticipanteService` — alta de participante + enlace `curso_participante`
  (devuelve `{id, participante_id, curso_participante_id}`).
- `ConstanciaService` — emisión idempotente: PDF (weasyprint), QR (`PUBLIC_VERIFICATION_URL/{codigo}`),
  folio secuencial (`AAC-YYYY-NNNNN`), hash SHA-256.

### Frontend (este release)
- **Helper de API aislado por flujo** (`app/demo/lib/api.ts`, `app/cliente/lib/api.ts`)
  con cabeceras `Bearer` correctas. NO se reusa `lib/auth.ts` (ver Bugs conocidos).
- **Proxy dev**: `next.config.js` ya reenvía `/api/:path*` → `:8000`; el frontend
  habla ruta relativa y Next lo proxiea (evita CORS de Safari).
- **PDFservido vía** `GET /api/v1/constancias/{id}/pdf` (pasa por el proxy), no por
  `/storage` (que no está en el rewrite).

---

## 3. Correcciones de multitenancy (contexto, del Sprint A)

El modelo de tenencia quedó unificado en Sprint A: `organizaciones(id)` es dueña de
los datos; `cursos.cliente_id`/`participantes.cliente_id` apuntan a
`organizaciones(id)`; el token trae siempre `{sub, role, org_id, org_name, permissions, source}`.
Este release **no modifica** ese modelo; solo consume los endpoints que lo respetan.

> Nota operativa: el login debe hacerse como **cliente** (`cliente.demo@aaces.mx`),
> no como usuario-plataforma (`admin.org@test.com`), porque este último revienta la
> FK `creado_por` (su `sub` no existe en `clientes`). Documentado para evitar
> confusión en demos.

---

## 4. Nuevas pantallas

### Demo aislado — `/demo/*`
- `/demo` — landing + login (botón "Entrar como demo" 1 click).
- `/demo/cursos` — lista + crear curso.
- `/demo/cursos/[id]` — participantes + acreditar + emitir constancia (modal con
  folio, código de validación, QR y vista previa PDF).
- `/demo/verificar/[codigo]` — verificación pública (sin token).

### Gestión real — `/cliente/cursos`
- `/cliente/cursos` — **lista limpia + crear curso** (se eliminó el bloque de
  pagos/calendario que antes amontonaba todo en una vista infinita).
- `/cliente/cursos/[id]` — **página dedicada del curso**: header del curso +
  tabla de participantes con **alta y edición consistentes** (mismos 6 campos que
  el backend guarda: nombre, correo, teléfono, empresa, cargo, ciudad), acreditar,
  emitir, eliminar.

### Resolución de UX señalada por el usuario
La captura previa (`app/cliente/cursos/page.tsx`, 1218 líneas) mostraba:
- formulario de alta con `apellido_paterno/materno`, `profesion`, `estado_pago`
  que el backend **descartaba** (inconsistencia alta vs edición);
- una "página sin fin" donde seleccionar curso no abría vista propia.

Se reconstruyó con:
- campos acotados a lo que el backend persiste;
- click en curso → página exclusiva `/cliente/cursos/[id]`.

---

## 5. Bugs conocidos que NO bloquean el release

1. **`lib/auth.ts` envía `Authorization: *** ${token}`** (debe ser `Bearer`).
   Los helpers nuevos lo evitan usando su propio header. No afecta `/demo` ni
   `/cliente/cursos` (usan los helpers aislados), pero debe corregirse antes de
   tocar otras pantallas que dependan de `lib/auth.ts`.
2. **13 errores TS heredados** en archivos fuera de scope:
   `app/cliente/participantes/[id]/page.tsx`, `app/admin/contacto/page.tsx`,
   `contexts/AuthContext.tsx`. El build pasa por `typescript.ignoreBuildErrors:true`,
   pero son deuda técnica real.
3. **`PUT /api/v1/participantes/{id}` ignora `estado_pago`** (los pagos viven en
   `/clientes/curso-participante/{cp_id}/pagos`, Sprint D). Por eso la edición no
   expone estado de pago: prometerlo sería mentir. Fuera de scope de este release.
4. **`PUBLIC_VERIFICATION_URL`** default `http://127.0.0.1:3000/v` en dev. El QR
   impreso en el PDF apunta a esa URL; en producción debe setearse al dominio real
   o el QR escaneado no resolverá. La página `/v/{codigo}` sí renderiza 200 local.
5. **Datos demo** generados durante la verificación (participantes/cursos/constancias
   de prueba en la org demo) no se han limpiado de la BD local.

---

## 6. Evidencia de verificación (esta sesión)

- Backend vivo en `:8000`, frontend en `:3000` (proxy). Login cliente → crear curso
  (201) → agregar participante (`curso_participante_id`) → acreditar (200) → emitir
  constancia (`folio AAC-2026-0007x`, PDF `application/pdf` válido) → verificar
  público (`valida: true`, org/RFC/participante/curso).
- `tsc --noEmit`: **0 errores** en `app/demo` y en `app/cliente/cursos` + `lib/api.ts`.
- Rutas `/demo/*` y `/cliente/cursos/*` renderizan 200 sin runtime errors.

---

## 7. Trabajo pendiente para el siguiente sprint

- [ ] Reparar `lib/auth.ts` (Bearer) y migrar pantallas restantes a los helpers aislados.
- [ ] Limpiar los 13 errores TS heredados (`participantes/[id]`, `admin/contacto`, `AuthContext`).
- [ ] Sprint C — Renovaciones (alertas de vigencia, recuperación de ingresos).
- [ ] Sprint D — Pagos y suscripciones (Stripe; rediseño del modelo actual).
- [ ] Setear `PUBLIC_VERIFICATION_URL` en producción + script de limpieza de datos demo.
- [ ] Marketplace (Sprint E).

---

## 8. Flujo de cierre (disciplina de release)

```
feature/rc1-tenant-truth
        │
        ▼  Revisión visual completa (preview pane)
        ▼  Pequeños ajustes de UX (sin tocar arquitectura)
        ▼  Commit final
        ▼  Pull Request
        ▼  Code Review + diff completo
        ▼  (squash si historial fragmentado)
        ▼  Merge → main
        ▼  Tag v0.5.0
```
