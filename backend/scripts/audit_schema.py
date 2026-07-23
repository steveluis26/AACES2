"""
AUDITORÍA DE ALINEACIÓN DE ESQUEMA (3 fuentes de verdad)
- Fuente 1: modelos SQLAlchemy (app/models/__init__.py)
- Fuente 2: BD real (information_schema de Postgres)
- Fuente 3: bootstrap SQL (se verifica por separado: ¿create_all crea lo mismo que la BD?)

Uso: PYTHONPATH=. python scripts/audit_schema.py
"""
import os
import sys
import asyncio
from sqlalchemy import create_engine, text, inspect as sa_inspect
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.database import engine as _engine
from app.models import Base

# ---- Fuente 2: BD real ----
async def get_bd_tables():
    async with _engine.connect() as c:
        res = await c.execute(text("""
            SELECT table_name, column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema='aaces'
            ORDER BY table_name, ordinal_position
        """))
        bd = {}
        for t, col, dt, nullable in res.fetchall():
            bd.setdefault(t, {})[col] = dt
        return bd

# ---- Fuente 1: modelos SQLAlchemy ----
def get_model_tables():
    md = Base.metadata
    out = {}
    for tname, table in md.tables.items():
        # tname puede ser 'aaces.cursos' o 'cursos'
        short = tname.split('.')[-1]
        cols = {}
        for col in table.columns:
            cols[col.name] = str(col.type)
        out[short] = cols
    return out

def main():
    # modelo sync (para metadata) no requiere event loop
    model = get_model_tables()
    # BD real requiere loop
    bd = asyncio.run(get_bd_tables())

    all_tables = sorted(set(model.keys()) | set(bd.keys()))
    print("="*80)
    print("AUDITORÍA DE ESQUEMA — modelos SQLAlchemy vs BD real (schema aaces)")
    print("="*80)
    print(f"Tablas en modelo: {len(model)} | Tablas en BD: {len(bd)}")
    print("-"*80)

    only_bd = sorted(set(bd) - set(model))
    only_model = sorted(set(model) - set(bd))
    if only_bd:
        print(f"[!] Tablas SOLO en BD (faltan en modelo): {only_bd}")
    if only_model:
        print(f"[!] Tablas SOLO en modelo (no existen en BD): {only_model}")

    total_diff = 0
    for t in all_tables:
        mcols = model.get(t, {})
        bcols = bd.get(t, {})
        if not mcols or not bcols:
            continue
        only_bd_c = sorted(set(bcols) - set(mcols))
        only_model_c = sorted(set(mcols) - set(bcols))
        if only_bd_c or only_model_c:
            total_diff += 1
            print(f"\n### TABLA: {t}")
            if only_bd_c:
                print(f"    [BD✓ modelo✗] columnas en BD que el MODELO NO declara: {only_bd_c}")
            if only_model_c:
                print(f"    [modelo✓ BD✗] columnas en MODELO que la BD NO tiene: {only_model_c}")
    print("-"*80)
    if total_diff == 0:
        print("✅ Todas las tablas coinciden en columnas (modelo vs BD).")
    else:
        print(f"⚠️  {total_diff} tabla(s) con desalineación de columnas.")
    print("="*80)

if __name__ == "__main__":
    main()
