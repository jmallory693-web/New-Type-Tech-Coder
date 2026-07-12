@echo off
setlocal
rem Stage 14: double-click launcher for the already packaged app.
rem Does not run Vite, npm, rebuild, install, or any project commands.

set "EXE=%~dp0release\win-unpacked\New Type Tech Coder.exe"

if not exist "%EXE%" (
  echo.
  echo New Type Tech Coder packaged app was not found.
  echo.
  echo Expected file:
  echo   %EXE%
  echo.
  echo What to do:
  echo   1. Double-click the installer if you have it:
  echo      release\New Type Tech Coder-0.1.0-Setup.exe
  echo   2. Or package the app first from a terminal:
  echo      npm run pack
  echo.
  echo This launcher does not rebuild or install anything.
  echo.
  pause
  exit /b 1
)

start "" "%EXE%"
exit /b 0
