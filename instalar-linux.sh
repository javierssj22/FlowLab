#!/bin/sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
if [ "$(uname -s)" != Linux ]; then
    printf '%s\n' 'Este instalador se ejecuta en Linux.' >&2
    exit 1
fi
if ! command -v python3 >/dev/null 2>&1; then
    printf '%s\n' 'Instala Python 3.10+ y su modulo venv. En Debian/Ubuntu: sudo apt install python3 python3-venv' >&2
    exit 1
fi
python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else "Se necesita Python 3.10 o posterior.")'
if [ ! -x .venv-linux/bin/python ]; then
    if ! python3 -m venv .venv-linux; then
        printf '%s\n' 'No se pudo crear el entorno. Revisa permisos de la carpeta y el paquete python3-venv.' >&2
        exit 1
    fi
fi
.venv-linux/bin/python -m pip install --no-index --find-links vendor/wheels --require-hashes -r requirements-offline.txt
.venv-linux/bin/python -c 'import serial, websockets; print("FlowLab listo: pyserial " + serial.VERSION + ", websockets " + websockets.__version__)'
printf '%s\n' 'Inicia con: sh start.sh' 'Puerto alternativo: sh start.sh --port 8772' 'Guia Linux y permisos USB: docs/LINUX.md'
