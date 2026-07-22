#!/usr/bin/env bash
# E2E: Verificar públicamente la constancia (el héroe).
source "$(dirname "$0")/common.sh"
CV=$(cat "$CV_FILE")
http_get "/api/v1/verificaciones/$CV" ""
step "Verificación pública" "$CODE"
echo "   $(echo "$BODY" | jq -c '{valida,organizacion,rfc,participante:(.participante.nombre),curso:(.curso.nombre),horas:(.curso.duracion_horas),hash_len:(.pdf_hash|length)}')"
