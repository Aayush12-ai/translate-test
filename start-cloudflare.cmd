@echo off
setlocal EnableExtensions

cd /d "%~dp0"

set "CLOUDFLARED_CMD="
if exist "%CD%\tools\cloudflared.exe" set "CLOUDFLARED_CMD=%CD%\tools\cloudflared.exe"

if not defined CLOUDFLARED_CMD (
  where cloudflared >nul 2>nul
  if not errorlevel 1 set "CLOUDFLARED_CMD=cloudflared"
)

if not defined CLOUDFLARED_CMD (
  echo cloudflared is not installed.
  echo Install it first with:
  echo   winget install --id Cloudflare.cloudflared -e
  echo or download the standalone binary to:
  echo   %CD%\tools\cloudflared.exe
  echo.
  echo Then run this script again.
  exit /b 1
)

if not exist ".env.local" (
  if exist ".env.local.example" (
    echo Creating .env.local from .env.local.example...
    copy ".env.local.example" ".env.local" >nul
    echo [ACTION REQUIRED] Please open .env.local, add your AZURE_TRANSLATOR_KEY, and run this script again.
    pause
    exit /b 1
  )
)

if exist ".env.local" (
  for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env.local") do (
    if /i not "%%~A"=="REM" set "%%~A=%%~B"
  )
)

if defined API_PORT (
  call :port_in_use %API_PORT%
  if not errorlevel 1 (
    echo API_PORT %API_PORT% is already in use. Update .env.local or free that port first.
    exit /b 1
  )
) else (
  call :choose_port API_PORT 18080 8080 3001 5001
  if errorlevel 1 exit /b 1
)

if defined WEB_PORT (
  call :port_in_use %WEB_PORT%
  if not errorlevel 1 (
    echo WEB_PORT %WEB_PORT% is already in use. Update .env.local or free that port first.
    exit /b 1
  )
) else (
  call :choose_port WEB_PORT 22041 22042 5173 3000
  if errorlevel 1 exit /b 1
)

if not defined API_PROXY_TARGET set "API_PROXY_TARGET=http://127.0.0.1:%API_PORT%"

echo Starting localhost servers from "%CD%"
start "api-server" /D "%CD%\artifacts\api-server" cmd /k "set PORT=%API_PORT% && npm.cmd run dev"
start "video-call" /D "%CD%\artifacts\video-call" cmd /k "set PORT=%WEB_PORT% && set API_PROXY_TARGET=%API_PROXY_TARGET% && npm.cmd run dev"

echo Waiting for the frontend to come up before opening Cloudflare Tunnel...
timeout /t 4 /nobreak >nul

echo.
echo Frontend: http://localhost:%WEB_PORT%
echo API health: http://127.0.0.1:%API_PORT%/api/healthz
echo.
echo A new terminal will open for Cloudflare Tunnel.
echo Copy the https://*.trycloudflare.com URL from that window and open it on your other devices.
start "cloudflare-tunnel" /D "%CD%" cmd /k "\"%CLOUDFLARED_CMD%\" tunnel --protocol http2 --url http://localhost:%WEB_PORT%"

echo.
echo Close the three opened terminal windows to stop the app and tunnel.
exit /b 0

:port_in_use
netstat -ano | findstr /R /C:":%~1 .*LISTENING" >nul
exit /b %errorlevel%

:choose_port
setlocal EnableExtensions
set "target_var=%~1"
shift

:choose_port_loop
if "%~1"=="" (
  echo Could not find a free port for %target_var%.
  endlocal & exit /b 1
)

call :port_in_use %~1
if errorlevel 1 (
  endlocal & set "%target_var%=%~1" & exit /b 0
)

shift
goto choose_port_loop
