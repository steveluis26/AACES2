#!/usr/bin/env bash
# AACES — helpers de pruebas E2E contra el backend local.
# No imprime el token JWT; lo guarda en un state file.
BASE="${AACES_BASE:-http://127.0.0.1:8000}"
CLI_EMAIL="${AACES_CLI_EMAIL:-cliente.demo@aaces.mx}"
CLI_PASS="${AACES_CLI_PASS:-demo1234}"

STATE_DIR=/tmp/aaces_e2e
mkdir -p "$STATE_DIR"
TOK_FILE="$STATE_DIR/tok"
CID_FILE="$STATE_DIR/cid"
CPID_FILE="$STATE_DIR/cpid"
PID_FILE="$STATE_DIR/pid"
CV_FILE="$STATE_DIR/cv"

aaces_login() {
  curl -s -m 10 -X POST "$BASE/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"correo\":\"$CLI_EMAIL\",\"password\":\"$CLI_PASS\"}" | jq -r .access_token
}

# http_post <path> <json> <tok>  -> deja CODE y BODY en globals
http_post() {
  local path="$1" json="$2" tok="$3" tmp
  tmp=$(mktemp)
  CODE=$(curl -s -o "$tmp" -w '%{http_code}' -m 30 -X POST "$BASE$path" \
    -H "Authorization: Bearer $tok" -H "Content-Type: application/json" -d "$json")
  BODY=$(cat "$tmp"); rm -f "$tmp"
}

# http_get <path> <tok>  -> CODE y BODY
http_get() {
  local path="$1" tok="$2" tmp
  tmp=$(mktemp)
  CODE=$(curl -s -o "$tmp" -w '%{http_code}' -m 10 -X GET "$BASE$path" \
    -H "Authorization: Bearer $tok")
  BODY=$(cat "$tmp"); rm -f "$tmp"
}

step() {
  local name="$1" code="$2"
  if [ "$code" = "200" ] || [ "$code" = "201" ]; then
    echo "✅ $name (HTTP $code)"
  else
    echo "❌ $name (HTTP $code)"
    [ -n "$BODY" ] && echo "   ↳ $(echo "$BODY" | head -c 300)"
  fi
}

load_tok() {
  local t; t=$(cat "$TOK_FILE" 2>/dev/null)
  if [ -z "$t" ] || [ "$t" = "null" ]; then t=$(aaces_login); echo "$t" > "$TOK_FILE"; fi
  echo "$t"
}

# Decodificar el payload (segundo segmento) de un JWT sin dependencias.
decode_jwt() {
  echo "$1" | cut -d. -f2 | tr '_-' '/+' | base64 -d 2>/dev/null
}
