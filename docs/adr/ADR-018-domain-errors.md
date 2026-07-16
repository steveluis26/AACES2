# ADR-018: Domain Errors (Services no conocen HTTP)

**Estado:** Aceptada
**Fecha:** 2026-07-16
**Contexto:** El servicio `auth.py` levantaba `HTTPException` directamente desde la capa de servicio, creando una dependencia de FastAPI en el dominio. Esto impedía reutilizar la lógica de autenticación fuera de un contexto HTTP.

**Decisión:** Los servicios usan errores de dominio (`DomainError`) en lugar de excepciones HTTP. Solo los endpoints traducen `DomainError` a `HTTPException`.

- Se define `DomainError` como clase base en `app/errors/`.
- Cada tipo de error de negocio es una subclase: `InvalidCredentialsError`, `UserInactiveError`, `ResourceNotFoundError`, etc.
- Los métodos de servicio declaran `raise DomainError` en su documentación.
- Los endpoints capturan `DomainError` usando un exception handler global o try/except.
- Services no importan nada de `fastapi`.

**Consecuencias:**
- La capa de dominio no tiene dependencias del framework web.
- Los servicios son reutilizables en contextos no HTTP (CLI, tests, workers, WebSocket).
- La traducción a HTTP es explícita y centralizada.
- Se introduce una nueva jerarquía de excepciones que debe mantenerse.

**Ejemplo:**
```python
# Service
class AuthService:
    async def authenticate(self, db, email, password):
        ...
        if user.org_estatus == 'pendiente':
            raise OrganizationPendingError()

# Endpoint
@app.post("/login")
async def login(...):
    try:
        user = await auth_service.authenticate(db, email, password)
    except OrganizationPendingError:
        raise HTTPException(status_code=403, detail="Cuenta pendiente")
```
