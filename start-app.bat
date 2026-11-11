@echo off
echo ========================================================
echo   Starting Trikuta Receipt OCR Application
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/3] Freeing ports 8000 and 5173 if occupied...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8000,5173 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo [2/3] Launching FastAPI Backend on http://127.0.0.1:8000...
start "Trikuta Backend" cmd /k "cd /d "%~dp0" && uv run uvicorn backend.app.main:app --host 127.0.0.1 --port 8000"

echo Waiting 3 seconds for backend to start...
timeout /t 3 /nobreak >nul

echo [3/3] Launching Vite Frontend on http://localhost:5173...
start "Trikuta Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo ========================================================
echo   Both services have been launched!
echo   Frontend : http://localhost:5173
echo   Backend  : http://127.0.0.1:8000
echo   API Docs : http://127.0.0.1:8000/docs
echo ========================================================
timeout /t 5
