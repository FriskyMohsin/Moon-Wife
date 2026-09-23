@echo off
title Install Maryam Native Messaging Host
color 0B
cls

echo ===============================================================
echo      REGISTER MARYAM NATIVE MESSAGING HOST FOR CHROME
echo ===============================================================
echo.

set HOST_NAME=com.maryam.browser.bridge
set MANIFEST_DIR=%~dp0
set MANIFEST_PATH=%MANIFEST_DIR%com.maryam.browser.bridge.json

:: Ensure path in JSON is absolute or points to batch file
powershell -Command "$json = Get-Content '%MANIFEST_PATH%' | ConvertFrom-Json; $json.path = '%MANIFEST_DIR%native_host.bat' -replace '\\', '\\'; $json | ConvertTo-Json | Set-Content '%MANIFEST_PATH%'"

echo Registering in Windows Current User Registry:
echo Key: HKCU\Software\Google\Chrome\NativeMessagingHosts\%HOST_NAME%
echo Path: %MANIFEST_PATH%
echo.

reg add "HKCU\Software\Google\Chrome\NativeMessagingHosts\%HOST_NAME%" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f

if %errorlevel% equ 0 (
    echo.
    echo [SUCCESS] Maryam Native Messaging Host registered cleanly!
    echo Chrome can now link Maryam to your authorized Chrome profiles.
) else (
    echo.
    echo [ERROR] Failed to register key in HKCU registry.
)

echo ===============================================================
pause
exit /b %errorlevel%
