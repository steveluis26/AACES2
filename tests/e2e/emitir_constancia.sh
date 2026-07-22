#!/usr/bin/env bash
# E2E: Emitir constancia (ruta real, genera PDF+QR+hash, idempotente).
source "$(dirname "$0")/common.sh"
TOK=$(load_tok)
CPID=$(cat "$CPID_FILE")
http_post "/api/v1/constancias/emitir" "{\"curso_participante_id\":\"$CPID\"}" "$TOK"
step "Emitir constancia" "$CODE"
echo "$BODY" | jq -r .documento.codigo_validacion > "$CV_FILE"
echo "   codigo_validacion=$(cat "$CV_FILE")  idempotente=$(echo "$BODY" | jq -r .documento.idempotente)"
