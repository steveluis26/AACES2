# AACES — Documentación de Endpoints y Frontend (Mapa Visual)

## Backend — Endpoints CRUD

- **Clientes**
  - `POST /api/v1/clientes` — backend/app/api/v1/endpoints/clientes.py:119
  - `PUT /api/v1/clientes/{cliente_id}` — backend/app/api/v1/endpoints/clientes.py:184
  - `DELETE /api/v1/clientes/{cliente_id}` — backend/app/api/v1/endpoints/clientes.py:219

- **Capacitadores**
  - `POST /api/v1/capacitadores` — backend/app/api/v1/endpoints/clientes.py:301
  - `PUT /api/v1/capacitadores/{capacitador_id}` — backend/app/api/v1/endpoints/clientes.py:372
  - `DELETE /api/v1/capacitadores/{capacitador_id}` — backend/app/api/v1/endpoints/clientes.py:434

- **Cursos**
  - `POST /api/v1/cursos` — backend/app/api/v1/endpoints/clientes.py:825
  - `PUT /api/v1/cursos/{curso_id}` — backend/app/api/v1/endpoints/clientes.py:1020
  - `DELETE /api/v1/cursos/{curso_id}` — backend/app/api/v1/endpoints/clientes.py:2870
  - Migraciones:
    - `POST /api/v1/cursos/{curso_id}/migrar-datos` — backend/app/api/v1/endpoints/clientes.py:2609
    - `POST /api/v1/cursos/migrar/todos` — backend/app/api/v1/endpoints/clientes.py:2807

- **Participantes de Curso**
  - `POST /api/v1/cursos/{curso_id}/participantes` — backend/app/api/v1/endpoints/clientes.py:1610
  - `PUT /api/v1/cursos/{curso_id}/participantes/{cp_id}` — backend/app/api/v1/endpoints/clientes.py:1931
  - `DELETE /api/v1/cursos/{curso_id}/participantes/{cp_id}` — backend/app/api/v1/endpoints/clientes.py:2050
  - Pagos:
    - `POST /api/v1/curso-participante/{cp_id}/pagos` — backend/app/api/v1/endpoints/clientes.py:1202
    - Precio:
      - `PUT /api/v1/curso-participante/{cp_id}/precio` — backend/app/api/v1/endpoints/clientes.py:1158

- **Grupos de Curso**
  - `POST /api/v1/grupos-curso` — backend/app/api/v1/endpoints/clientes.py:1842 y 2718
  - `PUT /api/v1/grupos-curso/{grupo_id}` — backend/app/api/v1/endpoints/clientes.py:1879 y 2755

- **Constancias**
  - `POST /api/v1/cursos/{curso_id}/constancias` — backend/app/api/v1/endpoints/clientes.py:2119
  - `POST /api/v1/cursos/{curso_id}/participantes/{cp_id}/constancias` — backend/app/api/v1/endpoints/clientes.py:2236

- **Tipos de Curso**
  - `POST /api/v1/tipos-curso` — backend/app/api/v1/endpoints/clientes.py:2411
  - `DELETE /api/v1/tipos-curso/{tipo_id}` — backend/app/api/v1/endpoints/clientes.py:2465

- **Auth**
  - `POST /api/v1/auth/login` — backend/app/api/v1/endpoints/auth.py:20
  - `POST /api/v1/auth/refresh` — backend/app/api/v1/endpoints/auth.py:118
  - `POST /api/v1/auth/logout` — backend/app/api/v1/endpoints/auth.py:206
  - `POST /api/v1/auth/dev-reset-password` — backend/app/api/v1/endpoints/auth.py:229
  - `PUT /api/v1/auth/profile` — backend/app/api/v1/endpoints/auth.py:309
  - `PUT /api/v1/clientes/me/password` — backend/app/api/v1/endpoints/clientes.py:2576

- **Admin**
  - `POST /api/v1/admin/clientes` — backend/app/api/v1/endpoints/admin.py:548
  - `PUT /api/v1/admin/clientes/{cliente_id}` — backend/app/api/v1/endpoints/admin.py:579
  - `DELETE /api/v1/admin/clientes/{cliente_id}` — backend/app/api/v1/endpoints/admin.py:608
  - `PUT /api/v1/admin/cursos/{curso_id}` — backend/app/api/v1/endpoints/admin.py:680
  - `PUT /api/v1/admin/curso-participante/{cp_id}/precio` — backend/app/api/v1/endpoints/admin.py:706

- **Validaciones**
  - `POST /api/v1/validaciones/validar-certificado` — backend/app/api/v1/endpoints/validaciones.py:18
  - `GET /api/v1/validaciones/constancias/{codigo_validacion}` — backend/app/api/v1/endpoints/validaciones.py:347

- **Agenda (Cliente)**
  - Próximos: `GET /api/v1/clientes/agenda/proximos` — backend/app/api/v1/endpoints/clientes.py:697
  - Por mes: `GET /api/v1/clientes/agenda/mes?year=YYYY&month=MM` — backend/app/api/v1/endpoints/clientes.py:751

## Frontend — Mapa Visual

- **Layout global y encabezado**
  - Header, navegación, logo clicable: `frontend/app/layout.tsx:29-55`
  - Estilos globales: `frontend/app/globals.css`

- **Home y Validación**
  - Home: `frontend/app/page.tsx`
  - Modal “Certificación Verificada”: `frontend/app/page.tsx:312-326`
  - Impresión/descarga (HTML generado): `frontend/app/page.tsx:44-104`

- **Login**
  - Página: `frontend/app/login/page.tsx:1-13`

- **Cliente**
  - Agenda/Calendario: `frontend/app/cliente/cursos/page.tsx`
    - Parseo de fechas local y días del rango: `frontend/app/cliente/cursos/page.tsx:273-299`
    - Render de celdas y ribbon visual: `frontend/app/cliente/cursos/page.tsx:748-771`
  - Perfil (cliente): `frontend/app/cliente/perfil/page.tsx:4-16, 36-83`
  - Gestión: `frontend/app/cliente/gestion/page.tsx:1-40`

- **Admin**
  - Clientes: `frontend/app/admin/clientes/page.tsx:8-40`
  - Perfil (admin): `frontend/app/admin/perfil/page.tsx:1-40`
  - Participantes del cliente: `frontend/app/admin/clientes/[id]/participantes/page.tsx:1-40`

- **Componentes UI**
  - Base: `frontend/components/ui/` (Button, Input, Card, Drawer, Table, etc.)
  - Navegación móvil (Drawer): `frontend/components/mobile-nav.tsx:1-40`

- **Servicios de API (Frontend)**
  - Wrapper `apiRequest` y servicios CRUD: `frontend/app/services/api.ts:1-423`
  - Uso típico: `apiRequest('/endpoint', { method: 'POST', body: JSON.stringify(data) })`

## Notas de Uso

- Autenticación: el wrapper `apiRequest` añade `Authorization: Bearer` si hay token en localStorage.
- Calendario del cliente usa el endpoint mensual para mostrar cursos pasados y presentes del mes seleccionado.
- En la validación de certificados, el modal toma `Capacitador` del certificado o de los datos guardados por el cliente (empresa), según disponibilidad.

