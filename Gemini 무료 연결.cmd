@echo off
title YesDetail - Paste Gemini API key here
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-ai.ps1" -GeminiFree
pause
