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
