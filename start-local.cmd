@echo off
setlocal EnableExtensions

cd /d "%~dp0"

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
)

if not defined WEB_PORT (
  call :choose_port WEB_PORT 22041 22042 5173 3000
  if errorlevel 1 exit /b 1
)

if not defined API_PROXY_TARGET set "API_PROXY_TARGET=http://127.0.0.1:%API_PORT%"

echo Starting local servers from "%CD%"
if defined DATABASE_URL (
  echo DATABASE_URL detected. API will use PostgreSQL.
) else (
  echo DATABASE_URL not set. API will fall back to in-memory rooms.
)

start "api-server" /D "%CD%\artifacts\api-server" cmd /k "set PORT=%API_PORT% && npm.cmd run dev"
start "video-call" /D "%CD%\artifacts\video-call" cmd /k "set PORT=%WEB_PORT% && set API_PROXY_TARGET=%API_PROXY_TARGET% && npm.cmd run dev"

echo.
echo Frontend: http://localhost:%WEB_PORT%
echo API health: http://127.0.0.1:%API_PORT%/api/healthz
echo.
echo Close the two opened terminal windows to stop the app.
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
