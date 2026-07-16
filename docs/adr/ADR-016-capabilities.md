# ADR-016: Capabilities como objeto anidado

**Estado:** Aceptada
**Fecha:** 2026-07-16
**Contexto:** Inicialmente las capacidades de un documento se exponían como booleanos sueltos en el DTO (`puede_cancelar`, `puede_reemitir`, `puede_descargar`). A medida que el sistema crece (curso, participante, template capabilities), los DTOs se llenan de campos sueltos y la cohesión se pierde.

**Decisión:** Las capacidades de una entidad se agrupan en un objeto anidado tipado.

- Backend define `DocumentCapabilities(BaseModel)` con campos como `cancelar`, `reemitir`, `descargar`, `compartir`.
- Cada agregado tiene su propia implementación: `DocumentCapabilities`, `CursoCapabilities`, `ParticipanteCapabilities`, `TemplateCapabilities`.
- Backend es la única fuente de verdad sobre qué acciones son posibles. Frontend nunca deduce capacidades.
- Los componentes React reciben `capabilities` como objeto y leen propiedades individuales (`capabilities.cancelar`).

**Consecuencias:**
- DTOs más limpios y cohesivos.
- Cada nueva entidad sigue el mismo patrón sin requerir nuevas decisiones.
- Frontend permanece ciego a reglas de negocio.
- Se requiere un viaje adicional de backend a frontend para cada campo de capability, pero el costo es despreciable comparado con el aislamiento que se gana.

**Ejemplo:**
```python
class DocumentCapabilities(BaseModel):
    cancelar: bool = False
    reemitir: bool = False
    descargar: bool = False
    compartir: bool = False

class ConstanciaDetalleResponse(BaseSchema):
    ...
    capabilities: DocumentCapabilities
```
