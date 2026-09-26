@echo off
setlocal
cd /d "%~dp0"
"C:\SameTimeWorldTools\SameTimeWorld_FirebaseUpdater.exe" --publish
set "RESULT=%ERRORLEVEL%"
pause
exit /b %RESULT%
