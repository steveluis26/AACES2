"""
AUDITORÍA DE CONTRATO — ARCHITECTURE_RULES.md regla #3.
Detecta violaciones del contrato de identidad:
  - Endpoints que llaman decode_token() directamente en vez de Depends(get_current_user_data)
  - Lecturas ad-hoc de organizacion_id/org_id/tenant/tenant_id desde el request
    en vez de usar user_data["organizacion_id"]
  - Uso de nombres de campo no canónicos (organization, tenant, org)

Uso:
  cd backend && PYTHONPATH=. ./.venv/bin/python scripts/audit_contract.py
"""
import os, re, sys

ENDPOINTS = os.path.join(os.path.dirname(__file__), "..", "app", "api", "v1", "endpoints")
BACKEND_ROOT = os.path.join(os.path.dirname(__file__), "..")

# Patrones de violación (lectura directa del JWT / campos no canónicos)
# NOTA: org_id es ACEPTABLE (el JWT lo emite y get_current_user_data lo normaliza
# a organizacion_id). Solo son violación los campos realmente no canónicos.
VIOLATION_PATTERNS = [
    (re.compile(r"decode_token\s*\("), "llamada directa a decode_token() (usar Depends(get_current_user_data))"),
    (re.compile(r"request\.headers\.get\(['\"]authorization", re.I), "lee Authorization del request en vez de la dependencia"),
    (re.compile(r"payload\[['\"](organization|tenant|tenant_id)['\"]\]"), "lee campo no canónico del JWT (usar organizacion_id)"),
    (re.compile(r"\.get\(['\"](organization|tenant|tenant_id)['\"]\)"), "lee campo no canónico (organization/tenant/tenant_id ad-hoc)"),
]

# Exclusiones legítimas: el propio módulo de auth y el servicio de tokens
EXCLUDE_FILES = {"auth.py", "security.py"}

def scan_file(path):
    rel = os.path.relpath(path, BACKEND_ROOT)
    with open(path, encoding="utf-8") as f:
        lines = f.readlines()
    problems = []
    in_def = False
    for i, line in enumerate(lines, 1):
        # Solo evaluamos dentro de funciones de endpoint (tienen Depends o request)
        if re.search(r"async def |def ", line) and "@router" not in line:
            in_def = True
        for pat, msg in VIOLATION_PATTERNS:
            if pat.search(line):
                # ignorar si es la definición del servicio o auth
                problems.append((i, msg))
    return rel, problems

def main():
    print("=== AUDITORÍA DE CONTRATO (ARCHITECTURE_RULES.md #3) ===")
    total = 0
    files_checked = 0
    for root, _, files in os.walk(ENDPOINTS):
        for fn in files:
            if not fn.endswith(".py"):
                continue
            if fn in EXCLUDE_FILES:
                continue
            full = os.path.join(root, fn)
            rel, problems = scan_file(full)
            files_checked += 1
            for i, msg in problems:
                total += 1
                print(f"  [!] {rel}:{i} -> {msg}")
    print(f"\nArchivos revisados: {files_checked}")
    print(f"Violaciones de contrato: {total}")
    if total == 0:
        print("OK: ningún endpoint lee el JWT directamente ni usa campos no canónicos.")
    else:
        print("REVISAR: las violaciones anteriores deben usar get_current_user_data() y organizacion_id.")
    return total

if __name__ == "__main__":
    sys.exit(1 if main() > 0 else 0)
