# Manual de Operación — AACES

## Respaldo de base de datos

```bash
pg_dump -U riquer -d aaces_db -F c -f /tmp/aaces_db_$(date +%Y%m%d_%H%M%S).dump
```

Para respaldo solo del esquema `aaces`:

```bash
pg_dump -U riquer -d aaces_db -n aaces -F c -f /tmp/aaces_schema_$(date +%Y%m%d).dump
```

## Restaurar un respaldo

```bash
pg_restore -U riquer -d aaces_db --clean --if-exists /tmp/aaces_db_20260716.dump
```

> `--clean` elimina objetos existentes antes de restaurar. Usar con precaución en producción.

## Verificar schema version

```sql
SELECT version, applied_at FROM aaces.schema_version ORDER BY applied_at DESC LIMIT 1;
```

O desde la API: consultar `/health` (devuelve status general).

## Aplicar migración V004

```bash
psql -U riquer -d aaces_db -f backend/migrations/V004__document_engine.sql
```

## Ejecutar bootstrap

El bootstrap se ejecuta automáticamente al iniciar el backend (fases en `main.py`).
Para ejecutarlo manualmente:

```bash
cd backend
python -c "
import asyncio
from app.bootstrap.schema import ensure_schema
from app.bootstrap.indexes import ensure_indexes
from app.bootstrap.seed import ensure_seed_data
from app.bootstrap.version import ensure_schema_version
from app.core.database import engine
from app.services.security import security_service

async def run():
    async with engine.connect() as conn:
        await ensure_schema(conn)
        await conn.commit()
        await ensure_indexes(conn)
        await conn.commit()
        await ensure_seed_data(conn, security_service.hash_password)
        await conn.commit()
        await ensure_schema_version(conn)
        await conn.commit()
    print('Bootstrap completado')

asyncio.run(run())
"
```

## Ejecutar Acceptance v1

```bash
cd backend
python ../scripts/acceptance_api.py
```

Resultado esperado:
```
Total: 27 | ✅ 27 | ❌ 0
Acceptance v1: 18/18 PASOS APROBADOS
```

## Revisar estado del servidor

```bash
# Health check básico
curl http://localhost:8000/health
# {"status": "healthy", "timestamp": "..."}

# Health check detallado (si existe el endpoint)
curl http://localhost:8000/api/v1/health/schema
```

## Logs

```bash
# Logs del backend (archivo)
tail -f /tmp/aaces_server.log

# Logs de Docker
docker compose logs -f backend

# Filtrar errores
grep -i "error\|exception\|traceback" /tmp/aaces_server.log
```

## Errores comunes

| Problema | Síntoma | Solución |
|---|---|---|
| Tabla no existe | `UndefinedTableError: relation "aaces.clientes" does not exist` | Ejecutar bootstrap o verificar migraciones |
| Contraseña no válida | `password cannot be longer than 72 bytes` | Verificar `bcrypt<4.1` en requirements |
| Puerto en uso | `Address already in use` | `lsof -ti:8000 \| xargs kill -9` |
| Transacción abortada | `current transaction is aborted` | Reiniciar backend (cada fase bootstrap usa `conn.connect()` separado) |
| FK violation | `ForeignKeyViolationError` | Verificar orden de inserción de datos |

## URLs de referencia

| Recurso | URL |
|---|---|
| API Docs (Swagger) | `http://localhost:8000/docs` |
| API Docs (ReDoc) | `http://localhost:8000/redoc` |
| Health check | `http://localhost:8000/health` |
| Frontend (dev) | `http://localhost:3000` |
