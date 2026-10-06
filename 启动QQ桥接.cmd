@echo off
cd /d "%~dp0"
pwsh -NoProfile -File scripts\start-configured-bridge.ps1
if errorlevel 1 pause
