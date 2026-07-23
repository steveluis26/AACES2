"""
audit_tenant.py — Gate de RC-1 (re-ejecutable desde RELEASE_CHECKLIST).

Verifica la REGLA DE ÚNICA FUENTE DE VERDAD DEL TENANT:
  El tenant para filtrado de datos se resuelve EXACTAMENTE UNA VEZ en
  get_current_user_data() (auth.py), que normaliza siempre `organizacion_id`.
  Ningún servicio/endpoint debe resolver el tenant por su cuenta.

ESTE AUDIT ES PRECISO A PROPÓSITO (sin falsos positivos que se ignoren):
  MARCA como violación SOLO:
    1. Resolutores prohibidos definidos: def _resolve_org / def _get_cliente_ids
       (estos resolvían tenant por su cuenta y fueron eliminados en RC-1).
    2. Filtros de datos que comparan contra :sub / {sub} en queries de
       cursos/constancias/participantes (sub = UUID del USUARIO, nunca debe
       filtrar esas tablas; deben usar organizacion_id).

NO MARCA (usos legítimos de sub):
    - emitido_por = sub / user_id = sub  (auditoría: quién emitió)
    - _uid_of(user_data)  (identidad del ejecutor, no filtro de tenant)
    - source == "usuario" en auth.py / get_current_user_data (normalización)

Uso:
  python scripts/audit_tenant.py
  exit 0 = limpio, exit 1 = violaciones.
"""
from __future__ import annotations
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
APP = BACKEND / "app"

# Resolutores prohibidos (resolvían tenant por su cuenta, eliminados en RC-1)
BANNED_DEFS = ["def _resolve_org", "def _get_cliente_ids"]

# Filtro de datos por sub en queries (anti-patrón de tenant)
# Detecta ":sub" o "{sub}" usado como valor de comparación en SQL embebido.
SUB_IN_QUERY = (":sub", "{sub}")

VIOLATIONS: list[str] = []


def scan_file(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    rel = str(path.relative_to(BACKEND))
    for lineno, line in enumerate(text.splitlines(), 1):
        for bad in BANNED_DEFS:
            if bad in line:
                VIOLATIONS.append(f"{rel}:{lineno} resolver prohibido definido: {bad}")
        # sub usado como valor de filtro en query SQL
        if any(tok in line for tok in SUB_IN_QUERY):
            low = line.lower()
            # ignorar usos de auditoría
            if "emitido_por" in low or "user_id" in low or "creado_por" in low:
                continue
            # ignorar asignación a variable (cid = user_data.get("sub"))
            if "user_data.get(" in line or "user_data[" in line:
                # es captura del sub a una variable, no filtro directo;
                # el riesgo real es cuando esa variable va a un WHERE.
                # lo dejamos pasar para no generar falsos positivos (S4 lo cubre).
                continue
            VIOLATIONS.append(
                f"{rel}:{lineno} posible filtro de datos por :sub (debe usar organizacion_id)"
            )


def main() -> int:
    py_files = [f for f in APP.rglob("*.py") if f.name != "tenant.py"]
    for f in py_files:
        scan_file(f)

    tenant_mod = APP / "core" / "tenant.py"
    if not tenant_mod.exists():
        VIOLATIONS.append("app/core/tenant.py no existe — fuente de verdad ausente")
    elif "def organization_id" not in tenant_mod.read_text():
        VIOLATIONS.append("app/core/tenant.py no define organization_id")

    if VIOLATIONS:
        print("=== AUDIT TENANT: VIOLACIONES ===")
        for v in VIOLATIONS:
            print("  -", v)
        print(f"\n{len(VIOLATIONS)} violación(es). Revisar fuente de verdad del tenant.")
        return 1
    print("AUDIT TENANT: OK — tenant resuelto en una sola fuente (app/core/tenant.py).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
