@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0\.."

echo.
echo ========================================
echo  Findly one-click local dev
echo  (Docker + ngrok + Shopify app)
echo ========================================
echo.

where docker >nul 2>nul
if errorlevel 1 (
  echo ERROR: Docker not found. Install/start Docker Desktop first.
  pause
  exit /b 1
)

docker info >nul 2>nul
if errorlevel 1 (
  echo ERROR: Docker Engine is not running. Open Docker Desktop and wait until "Engine running".
  pause
  exit /b 1
)

where ngrok >nul 2>nul
if errorlevel 1 (
  echo ERROR: ngrok not found on PATH.
  echo Restore/reinstall ngrok, add Defender exclusion, then reopen this window.
  pause
  exit /b 1
)

echo [1/4] Starting Postgres + worker...
docker compose up -d
if errorlevel 1 (
  echo docker compose failed ^(port 5432 conflict?^).
  pause
  exit /b 1
)

echo [2/4] Ensuring ngrok tunnel on port 3000...
powershell -NoProfile -Command "try { Invoke-RestMethod http://127.0.0.1:4040/api/tunnels | Out-Null; exit 0 } catch { exit 1 }" >nul 2>nul
if errorlevel 1 (
  start "Findly ngrok" cmd /k "ngrok http 3000"
  echo Started ngrok in a new window. Waiting for public URL...
) else (
  echo ngrok already running.
)

set "NGROK_URL="
for /l %%i in (1,1,30) do (
  for /f "usebackq delims=" %%u in (`powershell -NoProfile -Command "try { $t=(Invoke-RestMethod http://127.0.0.1:4040/api/tunnels).tunnels | Where-Object { $_.public_url -like 'https://*' } | Select-Object -First 1; if ($t) { $t.public_url } } catch { }"`) do set "NGROK_URL=%%u"
  if defined NGROK_URL goto :have_tunnel
  timeout /t 2 /nobreak >nul
)

echo ERROR: Could not read ngrok public URL from http://127.0.0.1:4040
echo Check the ngrok window for errors / Windows Security blocks.
pause
exit /b 1

:have_tunnel
echo Using tunnel: %NGROK_URL%

echo [3/4] Prisma setup...
call npm.cmd run setup
if errorlevel 1 (
  echo setup failed - check DATABASE_URL in .env
  pause
  exit /b 1
)

echo [4/4] Starting Shopify app dev...
echo Keep this window open. Press q to quit the Shopify CLI.
echo If Shopify shows an ngrok warning page, click Visit Site once.
echo.
set FRONTEND_PORT=3001
call npm.cmd run dev -- --tunnel-url=%NGROK_URL%:3000

endlocal
