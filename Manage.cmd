@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
  py -3 "_local\tools\manager.py"
) else (
  python "_local\tools\manager.py"
)
if errorlevel 1 pause
