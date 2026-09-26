@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules (
  call npm ci
  if errorlevel 1 goto :fail
)
call npm test
if errorlevel 1 goto :fail
call npm run build
if errorlevel 1 goto :fail
echo [OK] Build verified. Output: dist
pause
exit /b 0
:fail
echo [ERROR] Build stopped. Review the error above.
pause
exit /b 1
