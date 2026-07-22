#!/usr/bin/env bash
# RC: Validación multi-tenant (aislamiento entre organizaciones).
# Automatiza:
#   1) Crear 3 organizaciones independientes (Norte/Centro/Sur) + admin cliente c/u.
#   2) Cada admin crea un curso propio.
#   3) Admin Norte lista cursos -> solo ve los suyos.
#   4) Admin Norte intenta acceder al curso de Centro por ID -> 403/404 (aislamiento).
#   5) Dentro de la MISMA org, un 2º usuario (operador) ve el curso del admin.
#   6) Cleanup de las 3 orgs.
#
# Uso: bash tests/rc/multi_tenant_validation.sh
# Requere backend local vivo en http://127.0.0.1:8000
set -u
DIR="$(cd "$(dirname "$0")/.." && pwd)/e2e"
source "$DIR/common.sh"

PG=/opt/homebrew/opt/postgresql@15/bin/psql
PGOPT="aaces_db -U aaces_user -h 127.0.0.1"

ORGS=("Norte" "Centro" "Sur")
RFCS=("NT000000001" "CT000000001" "SR000000001")
MAILS=("admin.norte@rc-aaces.mx" "admin.centro@rc-aaces.mx" "admin.sur@rc-aaces.mx")

# Hash bcrypt de 'demo1234' generado con el mismo bcrypt del backend (cwd en backend/).
HASH_DEMO=$(cd /tmp/AACES2/backend && PYTHONPATH=. DYLD_LIBRARY_PATH=/opt/homebrew/lib GI_TYPELIB_PATH=/opt/homebrew/lib/girepository-1.0 ./.venv/bin/python -c "from app.services.security import security_service; print(security_service.hash_password('demo1234'))" 2>/dev/null)

TOK=("" "" "")
ORGID=("" "" "")
CURSOID=("" "" "")

passo() { echo "  ✅ $1"; }
fallo() { echo "  ❌ $1"; }

echo "════════════════════════════════════════════════"
echo "  RC — Validación Multi-Tenant (aislamiento)"
echo "════════════════════════════════════════════════"

# --- 1) Crear 3 organizaciones + admin cliente c/u ---
for i in 0 1 2; do
  nombre="${ORGS[$i]}"
  rfc="${RFCS[$i]}"
  mail="${MAILS[$i]}"
  SQLTMP=$(mktemp)
  cat > "$SQLTMP" <<SQL
SET search_path=aaces;
INSERT INTO organizaciones (id, rfc, razon_social, nombre_comercial, estado, ciudad, estatus)
VALUES (gen_random_uuid(), '$rfc', 'Capacitadora $nombre SA', 'Cap $nombre', 'Veracruz', 'Veracruz', 'activa')
ON CONFLICT (rfc) DO NOTHING;
SQL
  $PG -d $PGOPT -f "$SQLTMP" >/dev/null 2>&1
  oid=$($PG -d $PGOPT -t -A -c "SET search_path=aaces; SELECT id FROM organizaciones WHERE rfc='$rfc' LIMIT 1;")
  cat > "$SQLTMP" <<SQL
SET search_path=aaces;
INSERT INTO clientes (id, correo, nombre, password_hash, categoria, estado, organizacion_id, fecha_creacion)
VALUES (gen_random_uuid(), '$mail', 'Admin $nombre', '$HASH_DEMO', 'basico', 'activo', '$oid', now())
ON CONFLICT (correo) DO NOTHING;
SQL
  $PG -d $PGOPT -f "$SQLTMP" >/dev/null 2>&1
  rm -f "$SQLTMP"
  resp=$(curl -s -m 10 -X POST "$BASE/api/v1/auth/login" -H "Content-Type: application/json" -d "{\"correo\":\"$mail\",\"password\":\"demo1234\"}")
  tok=$(echo "$resp" | jq -r .access_token)
  if [ "$tok" = "null" ] || [ -z "$tok" ]; then
    fallo "login admin $nombre (resp: $(echo "$resp" | head -c 150))"
    continue
  fi
  TOK[$i]="$tok"
  ORGID[$i]=$(decode_jwt "$tok" 2>/dev/null | jq -r .org_id 2>/dev/null)
  passo "registrar Cap $nombre (org_id=${ORGID[$i]:0:8}...)"
done

# --- 2) Cada admin crea un curso propio ---
for i in 0 1 2; do
  ts=$(date +%s)
  resp=$(curl -s -m 10 -X POST "$BASE/api/v1/cursos" \
    -H "Authorization: Bearer ${TOK[$i]}" -H "Content-Type: application/json" \
    -d "{\"nombre\":\"Curso $i\",\"ciudad\":\"V\",\"fecha_inicio\":\"2026-11-02\",\"fecha_fin\":\"2026-11-03\",\"duracion_horas\":12,\"duracion_validacion\":24,\"codigo_curso\":\"RC-$i-$ts\",\"modalidad\":\"mixta\",\"estado\":\"activo\",\"empresa_contratante\":\"Emp $i\"}")
  cid=$(echo "$resp" | jq -r .id)
  CURSOID[$i]="$cid"
  [ "$cid" != "null" ] && passo "Cap ${ORGS[$i]}: creó curso $cid" || fallo "Cap ${ORGS[$i]}: crear curso"
done

# --- 3) Admin Norte lista cursos -> solo los suyos ---
N=0
lista=$(curl -s -m 10 -H "Authorization: Bearer ${TOK[0]}" "$BASE/api/v1/cursos")
for i in 0 1 2; do
  if echo "$lista" | jq -e --arg c "${CURSOID[$i]}" '.[]? | select(.id==$c)' >/dev/null 2>&1; then
    if [ "$i" = "0" ]; then N=$((N+1)); else fallo "fuga: Norte ve curso de ${ORGS[$i]}"; fi
  fi
done
[ "$N" = "1" ] && passo "aislamiento: Norte solo ve su curso (1)" || fallo "aislamiento: Norte ve $N cursos propios"

# --- 4) Admin Norte intenta acceder al curso de Centro por ID ---
c_centro="${CURSOID[1]}"
code=$(curl -s -o /dev/null -w '%{http_code}' -m 10 -X GET "$BASE/api/v1/cursos/$c_centro" -H "Authorization: Bearer ${TOK[0]}")
if [ "$code" = "403" ] || [ "$code" = "404" ]; then
  passo "aislamiento cruzado: Norte -> curso Centro = HTTP $code (bloqueado)"
else
  fallo "aislamiento cruzado: Norte accedió a Centro (HTTP $code) — FUGA"
fi

# --- 5) Misma org: 2º usuario (operador) ve el curso del admin ---
op_mail="operador.norte@rc-aaces.mx"
$PG -d $PGOPT -c "SET search_path=aaces; INSERT INTO clientes (id, correo, nombre, password_hash, categoria, estado, organizacion_id, fecha_creacion) VALUES (gen_random_uuid(), '$op_mail', 'Op Norte', (SELECT password_hash FROM clientes WHERE correo='${MAILS[0]}'), 'basico', 'activo', '${ORGID[0]}', now()) ON CONFLICT (correo) DO NOTHING;" >/dev/null 2>&1
op_tok=$(curl -s -m 10 -X POST "$BASE/api/v1/auth/login" -H "Content-Type: application/json" -d "{\"correo\":\"$op_mail\",\"password\":\"demo1234\"}" | jq -r .access_token)
if [ -z "$op_tok" ] || [ "$op_tok" = "null" ]; then
  fallo "login operador Norte"
else
  op_lista=$(curl -s -m 10 -H "Authorization: Bearer $op_tok" "$BASE/api/v1/cursos")
  if echo "$op_lista" | jq -e --arg c "${CURSOID[0]}" '.[]? | select(.id==$c)' >/dev/null 2>&1; then
    passo "intra-org: Operador Norte VE el curso del Admin Norte"
  else
    fallo "intra-org: Operador Norte NO ve el curso del admin (debería)"
  fi
fi

# --- 6) Cleanup ---
for i in 0 1 2; do
  $PG -d $PGOPT -c "SET search_path=aaces; DELETE FROM clientes WHERE correo='operador.norte@rc-aaces.mx'; DELETE FROM cursos WHERE codigo_curso LIKE 'RC-$i-%';" >/dev/null 2>&1
  $PG -d $PGOPT -c "SET search_path=aaces; DELETE FROM organizaciones WHERE rfc='${RFCS[$i]}';" >/dev/null 2>&1
done
echo "  🧹 Cleanup de orgs RC completo."
echo "════════════════════════════════════════════════"
echo "  RC Multi-Tenant: verde si todos los ✅ arriba."
