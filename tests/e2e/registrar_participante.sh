#!/usr/bin/env bash
# E2E: Registrar participante en el curso creado.
source "$(dirname "$0")/common.sh"
TOK=$(load_tok)
CID=$(cat "$CID_FILE")
http_post "/api/v1/cursos/$CID/participantes" '{"nombre":"Laura Gomez","correo":"laura.gomez.e2e@test.mx","telefono":"9211112222","empresa":"Industrias del Golfo SA","cargo":"Operadora"}' "$TOK"
step "Registrar participante" "$CODE"
echo "$BODY" | jq -r .curso_participante_id > "$CPID_FILE"
echo "$BODY" | jq -r .participante_id > "$PID_FILE"
echo "   curso_participante_id=$(cat "$CPID_FILE")"
