$ErrorActionPreference = 'Stop'
$sourceRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $sourceRoot
python -m venv work/build-env
if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el entorno.' }
& ./work/build-env/Scripts/python.exe -m pip install -r requirements-build.txt
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron instalar las dependencias.' }
& ./work/build-env/Scripts/python.exe -m PyInstaller --noconfirm --clean --onedir --name FlowLab --distpath work/dist --workpath work/pyinstaller --specpath work --add-data "$sourceRoot/web;web" --add-data "$sourceRoot/firmware;firmware" --add-data "$sourceRoot/boards.json;." --hidden-import serial.tools.list_ports_windows server.py
if ($LASTEXITCODE -ne 0) { throw 'Falló la compilación del ejecutable.' }
Copy-Item -LiteralPath README.md,LICENSE,THIRD-PARTY.md -Destination work/dist/FlowLab
& ./work/build-env/Scripts/python.exe scripts/copy-licenses.py work/dist/FlowLab/licenses
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron copiar las licencias.' }
Write-Host 'Ejecutable disponible en work/dist/FlowLab/FlowLab.exe'
