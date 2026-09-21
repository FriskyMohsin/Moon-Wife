@echo off
title Maryam Local Tool Runner & Browser Automation (Windows)
color 0B
cls

echo ===============================================================
echo      MARYAM LOCAL TOOL RUNNER - BROWSER CONTROL ENGINE
echo ===============================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 goto :no_node

echo [OK] Node.js detected:
node -v
echo.

:: Check for duplicate instance using a lock file approach
set "LOCKFILE=%~dp0.runner.pid"

if exist "%LOCKFILE%" (
    set /p OLDPID=<"%LOCKFILE%"
    if defined OLDPID (
        tasklist /fi "pid eq %OLDPID%" 2>nul | find /i "node.exe" >nul 2>&1
        if %errorlevel% equ 0 (
            echo [INFO] Maryam Runner already running (PID: %OLDPID%). Not starting duplicate.
            timeout /t 5 /nobreak >nul
            exit /b 0
        )
    )
)

echo %CURRENT_PID%> "%LOCKFILE%"

echo [1/3] Checking for updated runner script from Maryam Cloud...
curl -s -f --max-time 10 -o "%~dp0runner-update.cjs" "http://127.0.0.1:3000/api/runner/download/runner.cjs" 2>nul
if %errorlevel% equ 0 (
    move /y "%~dp0runner-update.cjs" "%~dp0runner.cjs" >nul 2>&1
    echo [OK] Runner script updated with latest browser control!
) else (
    if exist "%~dp0runner-update.cjs" del "%~dp0runner-update.cjs" >nul 2>&1
    echo [INFO] Using existing local runner script (cloud not reachable for update).
)
echo.

:: Determine relay URL
set RUN_ARGS=%*
if "%RUN_ARGS%"=="" (
    if defined MARYAM_RELAY_URL (
        set RUN_ARGS=--relay %MARYAM_RELAY_URL%
    ) else (
        set RUN_ARGS=--relay http://127.0.0.1:3000/api/runner/relay
    )
)

echo [2/3] Local Service:  http://127.0.0.1:48123 (Strict Localhost)
echo [2/3] Relay Target:   %RUN_ARGS%
echo.

:retry_loop
echo [3/3] Starting Maryam Local Runner...
echo.
node "%~dp0runner.cjs" %RUN_ARGS%
set EXITCODE=%errorlevel%

:: Clean up lock file on exit
if exist "%LOCKFILE%" del "%LOCKFILE%" >nul 2>&1

if %EXITCODE% equ 0 (
    echo.
    echo [INFO] Runner exited cleanly.
    exit /b 0
)

echo.
echo [WARN] Runner exited with code %EXITCODE%. Restarting in 5 seconds...
timeout /t 5 /nobreak >nul

:: Write new PID before restart
echo %CURRENT_PID%> "%LOCKFILE%"
goto :retry_loop

:no_node
color 0C
echo [ERROR] Node.js was not found in your Windows PATH!
echo.
echo Please install Node.js 18 or higher from: https://nodejs.org/
echo.
echo After installing Node.js, re-run this script.
echo ===============================================================
pause
exit /b 1
