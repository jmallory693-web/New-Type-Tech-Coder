@echo off
setlocal
rem Stage 14: create a Desktop shortcut to the packaged app (no admin required).
rem Does not run Vite, npm, rebuild, install, or any project commands.

set "SCRIPT=%~dp0Create-Desktop-Shortcut.ps1"

if not exist "%SCRIPT%" (
  echo.
  echo Missing helper script:
  echo   %SCRIPT%
  echo.
  echo You can still double-click: Open New Type Tech Coder.bat
  echo Or open: release\win-unpacked\New Type Tech Coder.exe
  echo.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%"
set "ERR=%ERRORLEVEL%"

if not "%ERR%"=="0" (
  echo.
  echo Shortcut creation failed.
  echo You can still double-click: Open New Type Tech Coder.bat
  echo Or open: release\win-unpacked\New Type Tech Coder.exe
  echo.
  pause
  exit /b %ERR%
)

echo.
pause
exit /b 0
