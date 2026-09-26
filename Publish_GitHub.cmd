@echo off
setlocal
cd /d C:\SameTimeWorld

where git >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Git was not found in PATH.
  echo Install Git for Windows or restart Windows after installing Git.
  pause
  exit /b 1
)

echo [1/4] Checking repository...
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo [ERROR] C:\SameTimeWorld is not a Git repository.
  pause
  exit /b 1
)

echo [2/4] Staging files...
git add -A
if errorlevel 1 goto :error

echo [3/4] Creating commit if needed...
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Update SameTimeWorld deployment"
  if errorlevel 1 goto :error
) else (
  echo No new changes to commit.
)

echo [4/4] Pushing to GitHub...
git push origin main
if errorlevel 1 goto :error

echo.
echo [OK] Push completed.
echo GitHub Actions will build and deploy the site automatically.
echo Site: https://yataje.github.io/sametimeworld/
pause
exit /b 0

:error
echo.
echo [ERROR] Publish failed. Copy this window text and send it to ChatGPT.
pause
exit /b 1
