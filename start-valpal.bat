@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js n'est pas installe. Telechargez la version LTS sur https://nodejs.org puis relancez ce fichier.
  pause
  exit /b 1
)

for /f "tokens=1 delims=v." %%v in ('node -v') do set NODE_MAJOR=%%v
if %NODE_MAJOR% LSS 22 (
  echo Node.js 22.18 ou plus recent est requis. Installez la version LTS sur https://nodejs.org
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installation des dependances, premiere fois uniquement...
  call npm install
  if errorlevel 1 (
    echo L'installation a echoue.
    pause
    exit /b 1
  )
)

echo Lancement de ValPal sur http://localhost:3000 ...
start "" cmd /c "timeout /t 8 >nul && start http://localhost:3000"
call npm run dev
pause
