@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Este lanzador estatico requiere Node.js 20 o posterior, sin Python.
  echo Tambien puedes publicar la carpeta web en un servidor HTTPS propio.
  pause
  exit /b 1
)
node scripts/serve-webserial.mjs
if errorlevel 1 pause
