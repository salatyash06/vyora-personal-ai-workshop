@echo off
cd /d "%~dp0frontend"
if not exist "node_modules" (
  echo Complete README step 6 first.
  pause
  exit /b 1
)
call npm.cmd run dev
pause
