#!/usr/bin/env bash
# E2E: Login de cliente demo (flujo de un capacitador).
source "$(dirname "$0")/common.sh"
TOK=$(aaces_login)
echo "$TOK" > "$TOK_FILE"
if [ -n "$TOK" ] && [ "$TOK" != "null" ]; then step "Login" 200; else step "Login" 000; fi
