# AACES — Sistema de Gestión de Capacitaciones y Certificaciones

Plataforma para gestionar cursos, participantes, certificados digitales y pagos, con validación pública de constancias.

**Estado:** M1 — Motor Documental Estable ✅ (Julio 2026)

> Arquitectura congelada. Solo se aceptan bugs, seguridad, performance y documentación.
> No se aceptan nuevos patrones, capas, ADRs ni refactors estructurales hasta nuevo aviso.
> Ver `docs/ARCHITECTURE_FROZEN.md`.

---

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Python 3.14 + FastAPI + SQLAlchemy async + PostgreSQL 15 |
| Frontend | Next.js 14 (App Router) + React 18 + TypeScript + Tailwind CSS |
| Cache | Redis 7 |
| Infra | Docker Compose + Nginx |

## Requisitos

- Docker y Docker Compose
- Node.js >= 18
- Python 3.11+

## Desarrollo local

```bash
# Opción 1: Solo Docker (todo incluido)
make up

# Opción 2: Desarrollo local con hot-reload
make dev
# Ejecuta backend (FastAPI en :8000) y frontend (Next.js en :3000)
```

Comandos útiles:

```bash
make frontend     # Solo frontend
make backend      # Solo backend
make lint         # Linters del frontend
make typecheck    # TypeScript check
make test         # Tests del frontend
make down         # Detener Docker
make logs         # Logs de Docker
```

## Validación

Antes de cualquier release, ejecutar el Acceptance Test:

```bash
# 1. Iniciar backend
cd backend && uvicorn main:app --reload

# 2. Ejecutar Acceptance v1
python scripts/acceptance_api.py

# 3. Verificar resultado: 18/18 (27 steps API)
#    "Acceptance v1: 18/18 PASOS APROBADOS"
```

El Acceptance Test cubre el flujo completo: login → crear curso → registrar participante → acreditar → emitir constancia → verificar → cancelar → reemitir → reportes.

Ver `docs/testing/acceptance-v1.md` para la especificación completa.

## Deploy gratis

El proyecto está listo para deploy en servicios gratuitos:

- **Backend + BD:** Render (usa `render.yaml`)
- **Frontend:** Vercel (configuración incluida) o Render
- **Almacenamiento PDFs:** Cloudflare R2 (10GB gratis)

### 1. Render (Backend + PostgreSQL)

1. Crea cuenta en https://render.com (conecta con GitHub)
2. Ve a "Blueprint" y selecciona tu repo (usa `render.yaml`)
3. Render despliega automáticamente: PostgreSQL + Backend Docker

### 2. Vercel (Frontend)

1. Crea cuenta en https://vercel.com (conecta con GitHub)
2. Importa el repo, configura:
   - Root directory: `frontend`
   - Framework: Next.js
   - Build command: `npm run build`
   - Env var: `NEXT_PUBLIC_API_URL=https://tu-backend.onrender.com`

### 3. Cloudflare R2 (PDFs)

1. Crea cuenta en https://cloudflare.com
2. Ve a R2 → Crear bucket `aaces-certificados`
3. Configura las credenciales en el backend

## Planes y límites

Por defecto los clientes se registran en **plan trial** (10 cursos máximo).
Los administradores pueden cambiar el plan, límite de cursos y descuento desde el panel de admin.

## Estructura

```
AACES/
├── backend/          FastAPI (Python)
│   ├── app/
│   │   ├── api/      Endpoints
│   │   ├── bootstrap/  Schema, indexes, seed, version, health
│   │   ├── services/   Lógica de negocio
│   │   ├── queries/    Query Objects
│   │   ├── commands/   Command Objects
│   │   ├── db/         DB errors, session
│   │   └── models/     SQLAlchemy models
│   └── migrations/   Migraciones SQL
├── frontend/         Next.js 14 (App Router)
├── scripts/          Migraciones SQL, seeds, acceptance test
├── docs/
│   ├── milestones/   Hitos del proyecto
│   ├── testing/      Acceptance test, performance baseline
│   └── pilot/        Pilot program documentation
├── nginx/            Configuración reverse proxy
├── config/           Variables de entorno
└── docker-compose.yml
```

## Documentación clave

| Documento | Propósito |
|---|---|
| `docs/milestones/M1-motor-documental-estable.md` | Hito M1 — alcance, evidencia, riesgos |
| `docs/ARCHITECTURE_FROZEN.md` | Reglas de congelamiento arquitectónico |
| `docs/testing/acceptance-v1.md` | Especificación del Acceptance Test |
| `docs/testing/performance-baseline-v1.md` | Línea base de rendimiento |
| `docs/OPERATIONS.md` | Manual de operación (backup, restore, bootstrap) |
| `docs/pilot/` | Programa piloto (checklist, feedback) |

## Licencia

Privado - Uso interno
# force redeploy
