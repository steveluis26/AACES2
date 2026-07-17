# Arquitectura Congelada

**Estado vigente desde:** M1 — Motor Documental Estable (Julio 2026)
**Próxima revisión:** Al completar el Pilot Program

## Regla general

La arquitectura del proyecto se considera congelada. No se aceptan cambios estructurales hasta que el piloto con usuarios reales genere evidencia suficiente para justificarlos.

## Se acepta

- **Bugs** — Correcciones que restauran el comportamiento esperado
- **Seguridad** — Parches de vulnerabilidades
- **Performance** — Optimizaciones que no alteran la estructura de capas
- **Documentación** — README, OPERATIONS, pilot docs, comentarios
- **Tests** — Nuevos tests que validan comportamiento existente
- **Datos de configuración** — Variables de entorno, seeds, catálogos

## No se acepta

- **Nuevos patrones arquitectónicos** — Sin nuevos ADRs
- **Nuevas capas** — Sin nuevas abstracciones entre endpoints y servicios
- **Refactors estructurales** — No mover archivos entre directorios
- **Cambios en la cadena de herencia de modelos** — No modificar Base ni mixins
- **Nuevas dependencias externas** — Sin nuevos packages en requirements.txt ni package.json
- **Cambios en la estructura de rutas API** — Sin renombrar endpoints existentes

## Excepciones

Cualquier excepción requiere:

1. Un issue documentado con el problema concreto que se resuelve
2. Evidencia de que la arquitectura actual no puede resolverlo
3. Aprobación explícita antes de implementar

## Vigencia

Esta freeze termina automáticamente cuando se cumplan ambas condiciones:

- Pilot Program completado con al menos 1 cliente real
- Feedback documentado en `docs/pilot/`

En ese punto se puede proponer una revisión arquitectónica con evidencia real de uso.
