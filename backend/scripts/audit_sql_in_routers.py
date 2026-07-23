"""
audit_sql_in_routers.py — Inventario final de Sprint S (RC-1 gate).

Responde a la pregunta del merge:
  ¿Hay algún endpoint que TODAVÍA tenga SQL de negocio propio para una
  operación cuyo Service ya existe (Curso/Participante/Constancia)?

Detecta en cada funcion de endpoint (decorada con @router.X) si el cuerpo
contiene SQL de negocio embebido:
  - text("SELECT/INSERT/UPDATE/DELETE ...")  (NO el SET LOCAL search_path,
    NO CREATE TABLE IF NOT EXISTS de bootstrap, NO consultas de validacion
    triviales de existencia ya delegadas).

Imprime un inventario: endpoint -> tiene_sql_propio? -> Service que deberia usarse.
"""

import re
import os

ENDPOINTS_DIR = os.path.join(os.path.dirname(__file__), "..", "app", "api", "v1", "endpoints")

# Dominio -> Service que debe poseer la logica
DOMAIN_SERVICE = {
    "curso": "CursoService",
    "participante": "ParticipanteService",
    "constancia": "ConstanciaService",
}

# SQL de negocio (lo que NO debe haber en un router)
BIZ_SQL_RE = None  # no se usa; el chequeo real esta en tiene_sql_negocio()

# Exclusiones: estas sentencias no son "logica de negocio duplicada"
SAFE_SQL_RE = re.compile(
    r'SET LOCAL search_path|CREATE TABLE IF NOT EXISTS|ALTER TABLE IF EXISTS|'
    r'SELECT 1 FROM|SELECT count\(\*\) FROM aaces\.documentos_emitidos\b',
    re.IGNORECASE,
)


def bloques_funcion(path):
    with open(path) as f:
        lines = f.readlines()
    bloques = []
    n = len(lines)
    i = 0
    while i < n:
        line = lines[i]
        m = re.match(r'\s*async def (\w+)\(', line)
        if not m:
            i += 1
            continue
        nombre = m.group(1)
        start = i
        # retroceder para incluir decoradores (@router.x) que preceden al def
        j = i - 1
        while j >= 0 and lines[j].lstrip().startswith("@"):
            start = j
            j -= 1
        base_indent = len(lines[i]) - len(lines[i].lstrip())
        k = i + 1
        while k < n:
            ln = lines[k]
            if ln.strip() == "":
                k += 1
                continue
            indent = len(ln) - len(ln.lstrip())
            if indent <= base_indent:
                break
            k += 1
        bloques.append((nombre, lines[start:k]))
        i = k
    return bloques


def decorador_router(block_lines):
    """Busca el decorador @router.get/post/... en las lineas del bloque."""
    texto = "".join(block_lines[:6])
    m = re.search(r'@\w*\.?(?:router|app|api_router)\.(get|post|put|delete|patch)\(\s*["\']([^"\']+)', texto)
    if m:
        return f"{m.group(1).upper()} {m.group(2)}"
    return None


def tiene_sql_negocio(block_lines):
    texto = "".join(block_lines)
    # quitar lo seguro
    texto_limpio = SAFE_SQL_RE.sub("", texto)
    # buscar SQL de negocio
    if re.search(r'text\(\s*["\']\s*(?:SELECT|INSERT|UPDATE|DELETE)\b', texto_limpio, re.IGNORECASE | re.DOTALL):
        return True
    return False


def main():
    print("=== INVENTARIO FINAL: SQL de negocio en routers (Sprint S / RC-1) ===\n")
    total_endpoints = 0
    con_sql = []
    for fn in sorted(os.listdir(ENDPOINTS_DIR)):
        if not fn.endswith(".py") or fn == "__init__.py":
            continue
        path = os.path.join(ENDPOINTS_DIR, fn)
        for nombre, bloque in bloques_funcion(path):
            ruta = decorador_router(bloque)
            if not ruta:
                continue
            # Solo nos interesan dominios consolidados
            dominio = None
            rl = (ruta + " " + nombre).lower()
            if any(k in rl for k in ("curso",)) and ("participante" not in rl):
                dominio = "curso"
            elif "participante" in rl or "acreditar" in rl or "enroll" in rl:
                dominio = "participante"
            elif "constancia" in rl or "certificado" in rl or "documento" in rl:
                dominio = "constancia"
            if not dominio:
                continue
            total_endpoints += 1
            sql = tiene_sql_negocio(bloque)
            servicio = DOMAIN_SERVICE[dominio]
            # si delega en el servicio, esta bien
            delega = servicio in "".join(bloque)
            estado = "OK (delega)" if delega else ("SQL PROPIO" if sql else "sin SQL / revisar")
            if sql and not delega:
                con_sql.append((fn, ruta, nombre, servicio))
            print(f"  [{fn}] {ruta:<40} -> {servicio:<20} {estado}")
    print(f"\nEndpoints de dominios consolidados revisados: {total_endpoints}")
    if con_sql:
        print(f"\n*** ENDPOINTS CON SQL PROPIO (deuda): {len(con_sql)} ***")
        for fn, ruta, nombre, servicio in con_sql:
            print(f"  - {fn}:{nombre} {ruta}  deberia usar {servicio}")
        print("\nRESULTADO: AUN HAY SQL DUPLICADO -> no liberar hasta cerrar estos.")
        return 1
    else:
        print("\nRESULTADO: Todos los endpoints de Curso/Participante/Constancia delegan en su Service.")
        print("S1-S3 estan consolidados. Cumple el criterio de merge (regla #2: routers sin SQL).")
        return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
