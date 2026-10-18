@echo off
title LC Correction Generator
color 0A

echo.
echo  ============================================
echo   LC Correction Generator - Starting...
echo  ============================================
echo.

:: Change to app directory
cd /d "C:\Users\PC\.gemini\antigravity\scratch\lc-correction-generator"

:: Check if node_modules exists
if not exist "node_modules" (
    echo  [!] First time setup - Installing dependencies...
    echo  Please wait a moment...
    npm install
)

echo  [OK] Starting server on http://127.0.0.1:5173
echo  [OK] Browser will open automatically...
echo.
echo  To STOP the server: Close this window
echo  ============================================
echo.

:: Start Vite in background, wait 2 seconds, then open browser
start "" /B npx vite --port 5173 --host 127.0.0.1

:: Wait for server to be ready
timeout /t 3 /nobreak > nul

:: Open browser
start "" "http://127.0.0.1:5173"

echo  [RUNNING] Server is live at http://127.0.0.1:5173
echo.
echo  Keep this window open while using the app.
echo  Press Ctrl+C or close this window to stop.
echo.

:: Keep window open (server runs in foreground via this wait)
:loop
timeout /t 60 /nobreak > nul
goto loop
