@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is required to run Art Through Time.
  echo Installing the current Node.js LTS version...
  where winget >nul 2>&1
  if errorlevel 1 (
    echo.
    echo Node.js is not installed, and Windows Package Manager ^(winget^) is unavailable.
    echo Install Node.js LTS from https://nodejs.org/ and run this file again.
    pause
    exit /b 1
  )

  winget install --id OpenJS.NodeJS.LTS --exact --silent --accept-package-agreements --accept-source-agreements
  if errorlevel 1 (
    echo.
    echo Node.js installation failed. Refreshing Windows Package Manager sources and trying once more...
    winget source reset --force
    winget source update
    winget install --id OpenJS.NodeJS.LTS --exact --silent --accept-package-agreements --accept-source-agreements
  )
  if errorlevel 1 (
    echo.
    echo Node.js installation did not finish.
    echo This can be caused by a certificate or network-proxy verification error.
    echo The verification was not bypassed for your safety.
    echo Opening the official Node.js download page. Install the LTS version, then run this file again.
    start "Node.js LTS download" https://nodejs.org/en/download
    pause
    exit /b 1
  )

  rem Make the newly installed Node.js available without requiring a sign-out or restart.
  set "PATH=%PATH%;%ProgramFiles%\nodejs"
  where node >nul 2>&1
  if errorlevel 1 (
    echo.
    echo Node.js was installed but is not available yet. Close this window and run this file again.
    pause
    exit /b 1
  )
)

if not exist "logs" mkdir "logs"
set "ART_ATLAS_PID="
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R /C:":4173 .*LISTENING"') do set ART_ATLAS_PID=%%a
if defined ART_ATLAS_PID (
  echo Art Through Time is already running on port 4173.
  echo Opening the existing Art Through Time login page...
  start "Art Through Time" http://localhost:4173/?login=1
  exit /b 0
)
start "Art Through Time Server" cmd /k "cd /d ""%~dp0"" && node server.js 1>> logs\art-atlas-server.out.log 2>> logs\art-atlas-server.err.log"
set /a ART_THROUGH_TIME_WAIT=0
:wait_for_art_through_time_server
curl.exe -fsS http://localhost:4173/api/access >nul 2>&1 && goto open_art_through_time
set /a ART_THROUGH_TIME_WAIT+=1
if %ART_THROUGH_TIME_WAIT% GEQ 10 goto open_art_through_time
timeout /t 1 /nobreak >nul
goto wait_for_art_through_time_server
:open_art_through_time
start "Art Through Time" http://localhost:4173/?login=1
