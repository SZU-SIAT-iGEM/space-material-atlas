@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" python -m venv .venv
".venv\Scripts\python.exe" -c "import fastapi,uvicorn" >nul 2>nul
if errorlevel 1 ".venv\Scripts\python.exe" -m pip install -r requirements-lock.txt
if errorlevel 1 exit /b 1
echo Open http://127.0.0.1:8765
".venv\Scripts\python.exe" -B manage.py serve
