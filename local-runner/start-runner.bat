@echo off
setlocal
rem Starts the scoped supervisor only when this canonical runner is unhealthy.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\manage-runner.ps1" -Command start
exit /b %ERRORLEVEL%
