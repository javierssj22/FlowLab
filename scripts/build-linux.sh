#!/bin/sh
# Build on the target Linux architecture; this does not cross-compile from Windows.
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
if [ "$(uname -s)" != Linux ]; then
    printf '%s\n' 'Ejecuta este script en Linux, sobre la arquitectura del destino.' >&2
    exit 1
fi
python3 -m venv work/build-linux
PY="$PWD/work/build-linux/bin/python"
"$PY" -m pip install -r requirements-build.txt
"$PY" -m PyInstaller --noconfirm --clean --onedir --name FlowLab \
    --distpath work/linux-dist --workpath work/pyinstaller-linux --specpath work \
    --add-data "$PWD/web:web" --add-data "$PWD/firmware:firmware" --add-data "$PWD/boards.json:." \
    --hidden-import serial.tools.list_ports_linux server.py
cp README.md LICENSE THIRD-PARTY.md CHANGELOG.md VALIDACION.md work/linux-dist/FlowLab/
cp -R docs examples firmware work/linux-dist/FlowLab/
"$PY" scripts/copy-licenses.py work/linux-dist/FlowLab/licenses
"$PY" scripts/smoke-distribution.py work/linux-dist/FlowLab/FlowLab
ARCH=$(uname -m)
tar -C work/linux-dist -czf "work/FlowLab-0.3-Linux-$ARCH-native.tar.gz" FlowLab
printf '%s\n' "Creado: work/FlowLab-0.3-Linux-$ARCH-native.tar.gz"
