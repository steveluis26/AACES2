# AACES

**Sistema de Gestión de Capacitaciones y Certificaciones**

Plataforma para gestionar cursos, participantes, certificados y pagos, con validación pública de certificados.

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Python FastAPI + SQLAlchemy async + PostgreSQL 15 |
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

## Deploy gratis

El proyecto está listo para deploy en servicios gratuitos:

- **Backend + BD**: Render (usa `render.yaml`)
- **Frontend**: Vercel (configuración incluida) o Render
- **Almacenamiento PDFs**: Cloudflare R2 (10GB gratis)

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
├── frontend/         Next.js 14 (App Router)
├── scripts/          Migraciones SQL y seeds
├── nginx/            Configuración reverse proxy
├── config/           Variables de entorno
├── docs/             Documentación
└── docker-compose.yml
```

## Licencia

Privado - Uso interno
