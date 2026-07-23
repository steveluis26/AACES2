"""
AUDITORÍA DE FILTRACIÓN MULTI-TENANT — ARCHITECTURE_RULES.md regla de seguridad.

BLOCKER DE RELEASE: cualquier endpoint GET que devuelva datos de negocio
(cursos, participantes, constancias, pagos, clientes) SIN filtrar por
organizacion_id cuando corresponde, es una filtración multi-tenant.

Escaneo por bloques de función (más robusto que ast para f-strings).
Para cada `async def`/`def` con decorador `@router.get`, captura el bloque
hasta la siguiente función y detecta:
  - si toca datos de negocio (select(Modelo) o FROM tabla_negocio)
  - si NO filtra por tenant (organizacion_id / cliente_id / org_id)
"""
import os
import re
import sys

ENDPOINTS = "app/api/v1/endpoints"
NEGOCIO_MODELOS = [
    "Curso", "Participante", "Constancia", "CursoParticipante",
    "Pago", "Cliente", "GrupoCurso", "TipoCurso", "ConstanciaCurso",
]
NEGOCIO_TABLAS = [
    "cursos", "participantes", "constancias", "curso_participante",
    "pagos", "clientes", "grupos_curso", "tipos_curso", "constancias_curso",
]
TENANT = re.compile(r"organizacion_id|cliente_id|org_id")
FUNC_RE = re.compile(r"^async def (\w+)|^def (\w+)|^    async def (\w+)|^    def (\w+)")
DECOR_RE = re.compile(r"@\w+\.get\(|@router\.get\(")
SELECT_MODEL_RE = re.compile(r"select\(\s*(" + "|".join(NEGOCIO_MODELOS) + r")\s*\)")
FROM_TABLE_RE = re.compile(r"FROM\s+(?:aaces\.)?(" + "|".join(NEGOCIO_TABLAS) + r")\b", re.IGNORECASE)


def bloques_funcion(path):
    """Yield (nombre, lineas_del_bloque) por cada funcion en el archivo.
    Incluye las líneas de decorador (@...) que preceden a def/async def."""
    with open(path) as f:
        lines = f.readlines()
    bloques = []
    cur = None
    for i, ln in enumerate(lines, 1):
        m = FUNC_RE.match(ln)
        if m:
            nombre = m.group(1) or m.group(2) or m.group(3) or m.group(4)
            if cur:
                bloques.append(cur)
            # retroceder para incluir decoradores (@...) inmediatos anteriores
            deco = []
            j = len(deco)
            k = i - 2  # línea anterior (0-indexed)
            while k >= 0 and lines[k].lstrip().startswith("@"):
                deco.insert(0, lines[k])
                k -= 1
            cur = {"name": nombre, "start": i, "lines": deco + [ln]}
        if cur:
            cur["lines"].append(ln)
    if cur:
        bloques.append(cur)
    return bloques


def analizar(path):
    problemas = []
    for b in bloques_funcion(path):
        texto = "".join(b["lines"])
        # ¿es GET? buscar decorador @router.get en las primeras líneas (indent 0)
        head = "".join(b["lines"][:4])
        if not DECOR_RE.search(head):
            continue
        toca = SELECT_MODEL_RE.search(texto) or FROM_TABLE_RE.search(texto)
        if not toca:
            # ¿FROM cursos etc. en SQL multilínea? ya cubierto por FROM_TABLE_RE
            continue
        if TENANT.search(texto):
            continue
        problemas.append((b["name"], b["start"]))
    return problemas


def main():
    total = 0
    print("=== AUDITORÍA DE FILTRACIÓN MULTI-TENANT ===")
    print("GET de datos de negocio SIN filtro de tenant (candidatos a filtración):\n")
    for root, _, files in os.walk(ENDPOINTS):
        for fn in sorted(files):
            if not fn.endswith(".py"):
                continue
            p = os.path.join(root, fn)
            try:
                probs = analizar(p)
            except Exception as e:
                print(f"  [ERR] {p}: {e}")
                continue
            for name, ln in probs:
                total += 1
                print(f"  [FILTRO?] {p}:{ln}  def {name}")
    print(f"\nTotal candidatos a filtración: {total}")
    if total > 0:
        print("ACCIÓN: añadir WHERE organizacion_id = :org (o JOIN con curso->org).")
        sys.exit(1)
    print("OK: todos los GET de negocio filtran por tenant.")


if __name__ == "__main__":
    main()
