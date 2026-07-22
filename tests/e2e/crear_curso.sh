#!/usr/bin/env bash
# E2E: Crear curso.
# codigo_curso UNICO por corrida para no chocar con uniqueness de BD.
source "$(dirname "$0")/common.sh"
TOK=$(load_tok)
TS=$(date +%s)
http_post "/api/v1/cursos" "{\"nombre\":\"Seguridad Industrial E2E\",\"ciudad\":\"Veracruz\",\"fecha_inicio\":\"2026-11-02\",\"fecha_fin\":\"2026-11-03\",\"duracion_horas\":12,\"duracion_validacion\":24,\"codigo_curso\":\"SEG-$TS\",\"modalidad\":\"mixta\",\"estado\":\"activo\",\"empresa_contratante\":\"Industrias del Golfo SA\"}" "$TOK"
step "Crear curso" "$CODE"
echo "$BODY" | jq -r .id > "$CID_FILE"
echo "   curso_id=$(cat "$CID_FILE")"
