@echo off
echo ==========================================
echo Building FitGoals AI - Frontend
echo ==========================================
cd /d "%~dp0frontend"
call npm install
if errorlevel 1 goto failed
call npm run build
if errorlevel 1 goto failed
echo.
echo BUILD OK - refresh http://localhost:8000 in your browser
pause
exit /b 0
:failed
echo.
echo BUILD FAILED - see the messages above
pause
