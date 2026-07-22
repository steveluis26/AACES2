#!/usr/bin/env bash
# AACES E2E — FLUJO COMPLETO (un solo comando).
# Ejecuta: ./tests/e2e/flujo_completo.sh
# Requiere backend local vivo en http://127.0.0.1:8000
set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
source "$DIR/common.sh"

# Reset de state files para evitar arrastrar UUIDs de corridas fallidas.
rm -f "$CID_FILE" "$CPID_FILE" "$PID_FILE" "$CV_FILE" "$TOK_FILE"

echo "════════════════════════════════════════════════"
echo "  AACES v0.8 — E2E FLUJO COMPLETO"
echo "════════════════════════════════════════════════════"

bash "$DIR/login.sh"
bash "$DIR/crear_curso.sh"
bash "$DIR/registrar_participante.sh"
bash "$DIR/acreditar.sh"
bash "$DIR/emitir_constancia.sh"
echo "--- re-emisión (debe ser idempotente, mismo código) ---"
bash "$DIR/emitir_constancia.sh"
bash "$DIR/verificar.sh"

echo ""
echo "════════════════════════════════════════════════════"
echo "  Resumen de verificación de integridad (BD)"
echo "════════════════════════════════════════════════════"
CV=$(cat "$CV_FILE" 2>/dev/null)
CPID=$(cat "$CPID_FILE" 2>/dev/null)
if [ -n "$CV" ] && [ -n "$CPID" ]; then
  PG=/opt/homebrew/opt/postgresql@15/bin
  NDOC=$($PG/psql -d aaces_db -U aaces_user -h 127.0.0.1 -t -A -c "SELECT count(*) FROM aaces.documentos_emitidos WHERE curso_participante_id='$CPID';" 2>/dev/null | tail -1)
  echo "   docs para este curso_participante: $NDOC (esperado: 1)"
  if [ "$NDOC" = "1" ]; then echo "✅ Idempotencia: sin duplicados"; else echo "❌ Idempotencia: $NDOC filas"; fi
fi
echo "Listo. Usa ./tests/e2e/cleanup.sh para borrar los datos de prueba."
