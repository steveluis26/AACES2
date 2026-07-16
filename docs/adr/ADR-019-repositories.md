# ADR-019: Repository Pattern

**Estado:** Propuesta
**Fecha:** 2026-07-16
**Contexto:** Los servicios (`ConstanciasService`, `DocumentosService`) contienen SQL directamente en sus métodos. A medida que el proyecto crece, el SQL se vuelve más complejo (JOINs, COUNTs separados, filtros condicionales) y mezcla lógica de negocio con acceso a datos.

**Decisión:** Todo SQL complejo (consultas con JOINs, filtros dinámicos, agregaciones) debe vivir en una capa de Repository, no en el Service.

- `ConstanciaRepository` sería responsable de consultas como `buscar_por_codigo()`, `listar()`, `contar()`, `obtener_detalle()`, `resumen()`.
- `ConstanciaService` solo orquesta reglas de negocio, sin construir consultas SQL.
- Los repositorios devuelven DTOs o tuplas, no objetos ORM.
- La decisión se documenta ahora pero se implementa progresivamente: cuando un service requiera una consulta nueva o refactorización significativa, se extrae al repository correspondiente.

**Consecuencias:**
- Separación clara entre lógica de negocio (Service) y acceso a datos (Repository).
- Las consultas son reutilizables entre services.
- Los tests de service pueden mockear el repository sin necesidad de base de datos.
- Aumenta el número de archivos y requiere disciplina para no mezclar responsabilidades.

**No implementar inmediatamente.** Esta decisión queda registrada para aplicarse cuando se refactorice o agregue una consulta significativa.
