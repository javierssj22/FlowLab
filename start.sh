#!/bin/sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
if [ -x .venv-linux/bin/python ]; then
    exec .venv-linux/bin/python server.py "$@"
fi
printf '%s\n' 'Primero ejecuta: sh instalar-linux.sh' >&2
exit 1
