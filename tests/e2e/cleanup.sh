#!/usr/bin/env bash
# Limpia los datos de prueba E2E de la BD local (no toca producción).
set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
source "$DIR/common.sh"
CV=$(cat "$CV_FILE" 2>/dev/null)
CID=$(cat "$CID_FILE" 2>/dev/null)
CPID=$(cat "$CPID_FILE" 2>/dev/null)
PID=$(cat "$PID_FILE" 2>/dev/null)
PG=/opt/homebrew/opt/postgresql@15/bin

[ -n "$CV" ]  && $PG/psql -d aaces_db -U aaces_user -h 127.0.0.1 -c "SET search_path=aaces; DELETE FROM documentos_emitidos WHERE codigo_validacion='$CV';" >/dev/null 2>&1
[ -n "$CPID" ] && $PG/psql -d aaces_db -U aaces_user -h 127.0.0.1 -c "SET search_path=aaces; DELETE FROM curso_participante WHERE id='$CPID';" >/dev/null 2>&1
[ -n "$PID" ]  && $PG/psql -d aaces_db -U aaces_user -h 127.0.0.1 -c "SET search_path=aaces; DELETE FROM participantes WHERE id='$PID';" >/dev/null 2>&1
[ -n "$CID" ]  && $PG/psql -d aaces_db -U aaces_user -h 127.0.0.1 -c "SET search_path=aaces; DELETE FROM cursos WHERE id='$CID';" >/dev/null 2>&1
rm -rf "$STATE_DIR"
echo "✅ Datos E2E de prueba eliminados."
