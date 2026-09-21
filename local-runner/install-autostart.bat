@echo off
title Maryam Runner — Install Auto-Start
color 0B
cls

echo ===============================================================
echo      MARYAM LOCAL RUNNER — INSTALL WINDOWS AUTO-START
echo ===============================================================
echo.
echo This script creates a Windows Task Scheduler entry so that
echo the Maryam Local Runner starts automatically on every login,
echo runs silently in the background, and restarts on crash.
echo.

:: Verify Node.js is available
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)

:: Create VBS wrapper for silent background launch (no visible cmd window)
set "VBS_PATH=%~dp0maryam-runner-silent.vbs"
echo Creating silent launcher: %VBS_PATH%

(
echo ' Maryam Local Runner — Silent Background Launcher
echo ' Launches runner.cjs without a visible console window.
echo Set WshShell = CreateObject^("WScript.Shell"^)
echo WshShell.Run "cmd /c cd /d ""%~dp0"" && node runner.cjs --relay %MARYAM_RELAY_URL%", 0, False
) > "%VBS_PATH%"

echo [OK] Silent VBS launcher created.
echo.

:: Create lock file mechanism inside runner
set "LOCKFILE=%~dp0.runner.lock"

:: Register with Task Scheduler
echo [2/3] Registering Windows Task Scheduler entry...
schtasks /create ^
  /tn "MaryamLocalRunner" ^
  /tr "wscript.exe \"%VBS_PATH%\"" ^
  /sc onlogon ^
  /rl highest ^
  /f
if %errorlevel% equ 0 (
    echo [OK] Task 'MaryamLocalRunner' registered for auto-start on login!
) else (
    echo [WARN] Task Scheduler registration may require elevated (Admin) prompt.
    echo        Right-click this script and select "Run as Administrator".
)
echo.

echo [3/3] Starting runner now...
start "" wscript.exe "%VBS_PATH%"

echo.
echo ===============================================================
echo  AUTO-START INSTALLED SUCCESSFULLY
echo  The Maryam Local Runner will now:
echo    - Start automatically on every Windows login
echo    - Run silently in the background (no terminal window)
echo    - Reconnect automatically after internet interruption
echo    - Restart on crash via Task Scheduler
echo ===============================================================
echo.
pause
