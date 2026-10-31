@echo off
rem Double-click to run BandUp locally: npm run dev (PostgreSQL service + LanguageTool + API + web) -> browser.
rem Close the window to stop.
chcp 65001 >nul
title BandUp
cd /d "%~dp0"
set "PATH=%PATH%;C:\Program Files\nodejs;%APPDATA%\npm"

start "" /b powershell -NoProfile -WindowStyle Hidden -Command "while (-not (Test-NetConnection localhost -Port 30000 -InformationLevel Quiet -WarningAction SilentlyContinue)) { Start-Sleep 2 }; Start-Process http://localhost:30000"
call npm run dev
pause
