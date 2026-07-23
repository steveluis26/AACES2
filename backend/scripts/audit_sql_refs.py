"""
AUDITORÍA 2: referencias SQL crudas vs esquema real.
Escanea todo el código backend buscando consultas text(...) y extrae
las columnas/tablas referenciadas, luego valida que existan en la BD real.
Esto detecta bugs tipo 'organizaciones.nombre' (debería ser razon_social)
ANTES de que el usuario los encuentre en el navegador.
"""
import os
import re
import asyncio
from sqlalchemy import text
from app.core.database import engine as _engine

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

async def get_bd_columns():
    async with _engine.connect() as c:
        res = await c.execute(text("""
            SELECT table_name, column_name
            FROM information_schema.columns
            WHERE table_schema='aaces'
        """))
        d = {}
        for t, col in res.fetchall():
            d.setdefault(t, set()).add(col)
        return d

def extract_sql_strings(path):
    with open(path, encoding='utf-8', errors='ignore') as f:
        src = f.read()
    # text(""" ... """) y text(" ... ")
    blocks = re.findall(r'text\(\s*[`"\']{1,3}(.*?)[`"\']{1,3}\s*\)', src, re.DOTALL)
    return blocks

def analyze(bd, blocks, fname):
    problems = []
    # Mapeo alias -> tabla real (patrón FROM/JOIN tabla alias)
    alias_map_re = re.compile(r'(?:FROM|JOIN)\s+(?:aaces\.)?([a-z_]+)(?:\s+(?:AS\s+)?([a-z_]+))?', re.IGNORECASE)
    col_re = re.compile(r'\b([a-z_]+)\.([a-z_]+)\b')
    skip_cols = {'id', 'org_id', 'cid', 'lim', 'dias', 'limite', 'sub', 'user_id',
                 'count', 'total', 'now', 'current_date', 'date_trunc', 'gen_random_uuid',
                 'interval'}
    for blk in blocks:
        alias_to_table = {}
        for m in alias_map_re.finditer(blk):
            tbl, alias = m.group(1), m.group(2)
            if alias:
                alias_to_table[alias] = tbl
            else:
                alias_to_table[tbl] = tbl  # tabla sin alias
        for m in col_re.finditer(blk):
            alias, col = m.group(1), m.group(2)
            if col in skip_cols or alias in skip_cols:
                continue
            if alias in alias_to_table:
                t = alias_to_table[alias]
                if t in bd and col not in bd[t]:
                    problems.append(f"{t}.{col} (alias {alias})")
    return problems

def main():
    bd = asyncio.run(get_bd_columns())
    all_problems = []
    for root, _, files in os.walk(os.path.join(BACKEND, 'app')):
        for fn in files:
            if not fn.endswith('.py'):
                continue
            p = os.path.join(root, fn)
            blocks = extract_sql_strings(p)
            if not blocks:
                continue
            probs = analyze(bd, blocks, p)
            for pr in probs:
                all_problems.append((os.path.relpath(p, BACKEND), pr))
    print("=" * 80)
    print("AUDITORIA 2: columnas en SQL crudo vs BD real")
    print("=" * 80)
    uniq = sorted(set(all_problems))
    if not uniq:
        print("OK: no se detectaron referencias a columnas inexistentes.")
    else:
        for p, pr in uniq:
            print(f"[!] {pr}  ->  {p}")
    print("-" * 80)
    print(f"Total referencias sospechosas: {len(uniq)}")
    print("=" * 80)

if __name__ == "__main__":
    main()
