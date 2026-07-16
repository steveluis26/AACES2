# ADR-017: ViewModel Boundary (Mapper Pattern)

**Estado:** Aceptada
**Fecha:** 2026-07-16
**Contexto:** Los componentes React comenzaban a consumir directamente propiedades de la respuesta de la API (`apiResponse.nombre`). Esto genera acoplamiento entre la UI y la estructura del backend: cualquier cambio en la API requiere cambios en múltiples componentes.

**Decisión:** Se establece una regla arquitectónica estricta:

```
Componentes UI → ViewModel → Adapter → API
```

Nunca:
```
Componentes UI → API
```

- Los componentes React nunca consumen DTOs provenientes de la API.
- Cada entidad tiene un mapper que transforma DTO → ViewModel.
- Los ViewModels son tipos planos de TypeScript, sin dependencias del backend.
- Los Adapters hacen la llamada HTTP y aplican el mapper.
- Los componentes solo conocen ViewModels.

**Consecuencias:**
- La UI está aislada de cambios en la API. Renombrar un campo en backend solo requiere cambiar el mapper.
- Los ViewModels pueden computar valores derivados (nombres completos, fechas formateadas, etc.).
- El código es más testeable: los mappers son funciones puras.
- Más archivos de mapping, pero cada uno es pequeño y de una sola responsabilidad.

**Ejemplo:**
```typescript
// ❌ Prohibido
<p>{apiResponse.nombre}</p>

// ✅ Correcto
<p>{viewModel.nombre}</p>
```
