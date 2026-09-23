@echo off
setlocal
rem Installs only the per-user MaryamLocalRunner scheduled task. This never
rem downloads or overwrites the runner and never starts a duplicate instance.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\manage-runner.ps1" -Command install
exit /b %ERRORLEVEL%
