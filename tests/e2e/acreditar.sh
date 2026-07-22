#!/usr/bin/env bash
# E2E: Acreditar participante.
source "$(dirname "$0")/common.sh"
TOK=$(load_tok)
PID=$(cat "$PID_FILE")
http_post "/api/v1/participantes/$PID/acreditar" '{"calificacion":90}' "$TOK"
step "Acreditar" "$CODE"
