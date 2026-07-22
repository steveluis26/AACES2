#!/bin/bash
# Launcher del backend AACES local.
# Exporta las librerías nativas de GTK (Homebrew) que weasyprint necesita en macOS,
# y usa el venv explícito del proyecto (evita el venv de Hermes).
cd /tmp/AACES2/backend
export PYTHONPATH=
export DYLD_LIBRARY_PATH=/opt/homebrew/lib
export GI_TYPELIB_PATH=/opt/homebrew/lib/girepository-1.0
export PKG_CONFIG_PATH=/opt/homebrew/lib/pkgconfig
exec ./.venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload --log-level warning
