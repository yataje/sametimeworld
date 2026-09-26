@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules (
  call npm ci
  if errorlevel 1 goto :fail
)
call npm run dev
if errorlevel 1 goto :fail
exit /b 0
:fail
echo [ERROR] Server did not start. Review the error above.
pause
exit /b 1
