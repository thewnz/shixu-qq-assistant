@echo off
cd /d "%~dp0"
if not exist node_modules\electron\dist\electron.exe (
  echo Please run npm.cmd install first.
  pause
  exit /b 1
)
if not exist dist\index.html (
  call npm.cmd run build
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
call npm.cmd run desktop
