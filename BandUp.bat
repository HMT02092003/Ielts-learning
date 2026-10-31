@echo off
rem Double-click to run BandUp locally: Docker Desktop -> npm run dev -> browser. Close the window to stop.
chcp 65001 >nul
title BandUp
cd /d "%~dp0"
set "PATH=%PATH%;C:\Program Files\nodejs;C:\Program Files\Docker\Docker\resources\bin;%APPDATA%\npm"

docker info >nul 2>&1
if not errorlevel 1 goto run
echo Dang mo Docker Desktop...
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
:wait
timeout /t 3 /nobreak >nul
docker info >nul 2>&1
if errorlevel 1 goto wait

:run
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "while (-not (Test-NetConnection localhost -Port 30000 -InformationLevel Quiet -WarningAction SilentlyContinue)) { Start-Sleep 2 }; Start-Process http://localhost:30000"
call npm run dev
pause
