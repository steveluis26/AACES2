# Issues Conocidos — Pre-Piloto

## Bootstrap

- `create_tipos_curso` y `create_grupos_curso` fallan si `clientes` no existe. Son warning no fatales (savepoint aísla el error).
- `create_legacy_fixes` ejecuta ALTER TABLEs sobre tablas que pueden no existir. Cada statement está envuelto en savepoint.

## Auth

- Login con credenciales inválidas incrementa `intentos_fallidos`. Después de 5 intentos, la cuenta se bloquea 30 minutos.
- El bloqueo persiste en BD incluso si el servidor se reinicia.

## Constancias

- El PDF descargado es un placeholder minimalista, no un documento real generado con WeasyPrint.
- `codigo_validacion` usa UUID v4 (36 chars). La verificación pública es por matching exacto.

## Reportes

- `tiempo-promedio-emision` puede devolver 0.0 si la constancia y el certificado se emitieron en el mismo segundo.
- Los reportes filtran por `organizacion_id`. Clientes legacy sin organización asociada pueden no ver datos.
