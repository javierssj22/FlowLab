@echo off
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Instala Python 3.10 o superior y marca Add Python to PATH.
  pause
  exit /b 1
)
python server.py
if errorlevel 1 pause
