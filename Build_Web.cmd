@echo off
chcp 65001 >nul
cd /d C:\SameTimeWorld
if not exist node_modules (
  echo [SameTimeWorld] npm packages are not installed. Installing...
  call npm install
  if errorlevel 1 pause & exit /b 1
)
call npm run build
pause
