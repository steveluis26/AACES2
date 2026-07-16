# ADR-015: Query Objects

**Estado:** Aceptada
**Fecha:** 2026-07-16
**Contexto:** Los servicios empezaron a recibir múltiples parámetros de consulta (hasta 10 en `ConstanciasService.listar()`), lo que hacía los métodos difíciles de leer, testear y evolucionar. Cada nuevo filtro implicaba cambiar la firma del método y todos sus callers.

**Decisión:** Todo método público de un Application Service que reciba más de 3 parámetros (sin contar `self` y `db`) deberá recibir un objeto tipado (`Query` o `Command`) en lugar de parámetros sueltos.

- Los objetos viven en `app/queries/` (consultas) y `app/commands/` (mutaciones).
- No aplica a métodos privados ni al motor documental (`DocumentService`, `TemplateEngine`), donde el costo de un objeto adicional supera el beneficio.
- Los objetos usan Pydantic `BaseModel` con validación.

**Consecuencias:**
- Las firmas de servicio se estabilizan: agregar un filtro no cambia la firma.
- Los objetos son serializables y faciles de testear.
- Prepara el terreno para un posible CQRS futuro.
- Se introduce un archivo por query/command, lo que aumenta el número total de archivos.

**Ejemplos:**
```python
# ❌ Antes
async def listar(db, org_id, q, estado, fecha_desde, fecha_hasta, ...)

# ✅ Después
async def listar(db, org_id, query: ConstanciaListQuery)
```
