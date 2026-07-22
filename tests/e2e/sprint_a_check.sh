#!/usr/bin/env bash
# Verificación Sprint A: reglas de negocio + dominio multiempresa.
source "$(dirname "$0")/common.sh"
BASE="${AACES_BASE:-http://127.0.0.1:8000}"
TOK=$(load_tok)
CID=$(cat "$CID_FILE" 2>/dev/null)
CPID=$(cat "$CPID_FILE" 2>/dev/null)
CV=$(cat "$CV_FILE" 2>/dev/null)

PG=/opt/homebrew/opt/postgresql@15/bin/psql
P="aaces_db -U aaces_user -h 127.0.0.1 -t -A"

echo "═══════ SPRINT A — VERIFICACIÓN ═══════"

# 1) Teléfono obligatorio: intentar crear participante sin teléfono
NO_TEL=$(curl -s -o /dev/null -w '%{http_code}' -m 10 -X POST "$BASE/api/v1/cursos/$CID/participantes" \
  -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
  -d "{\"nombre\":\"Sin Telefono Test\",\"correo\":\"notel@test.mx\"}")
echo "1) Teléfono obligatorio → HTTP $NO_TEL (esperado 400)"

# 2) Vigencia + folio en la emisión ya hecha
echo "2) Emisión (vigencia/folio):"
curl -s -m 10 "$BASE/api/v1/verificaciones/$CV" | jq -c '{valida,folio,curso_vence:(.curso.expiracion),participante:(.participante.nombre)}' 2>/dev/null || echo "   (verificar falló)"
BD=$( $PG $C -c "SELECT d.folio, cp.fecha_inicio_vigencia::text, cp.fecha_expiracion::text, cp.fecha_acreditacion::text FROM aaces.documentos_emitidos d JOIN aaces.curso_participante cp ON cp.id=d.curso_participante_id WHERE d.codigo_validacion='$CV';" 2>/dev/null)
echo "   BD: $BD"

# 3) Dominio multiempresa: el curso tiene organizacion_id == org del token
ORG=$(echo "$TOK" | jq -R 'split(".")[1]' 2>/dev/null | base64 -d 2>/dev/null | jq -r .org_id 2>/dev/null)
CURSO_ORG=$( $PG $C -c "SELECT organizacion_id::text FROM aaces.cursos WHERE id='$CID';" 2>/dev/null)
echo "3) Multitenancy: token.org_id=$ORG  curso.organizacion_id=$CURSO_ORG"
if [ "$ORG" = "$CURSO_ORG" ]; then echo "   ✅ curso ligado a la org del usuario"; else echo "   ❌ desalineado"; fi

# 4) Acreditación setea fecha_acreditacion
AC=$( $PG $C -c "SELECT fecha_acreditacion::text FROM aaces.curso_participante WHERE id='$CPID';" 2>/dev/null)
echo "4) fecha_acreditacion poblada: ${AC:-NULL} $([ -n "$AC" ] && [ "$AC" != "NULL" ] && echo '✅' || echo '❌')"
