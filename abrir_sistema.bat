@echo off
title Melidan - Sistema Gastronomico con PostgreSQL
color 0A
echo ===================================================================
echo     MELIDAN - SISTEMA INTEGRAL DE CONTROL GASTRONOMICO
echo     Conectado a Base de Datos PostgreSQL 18 (Melidan_db)
echo ===================================================================
echo.
echo [1/3] Verificando entorno PHP y PostgreSQL...
echo       - Motor BD: PostgreSQL 18 (localhost:5432)
echo       - Base de Datos: Melidan_db
echo       - Usuario: postgres
echo       - Clave: root
echo.
echo [2/3] Levantando servidor web local en http://localhost:8000 ...
start /B "" "C:\Users\joset_\php\php.exe" -S localhost:8000
timeout /t 2 /nobreak >nul
echo.
echo [3/3] Abriendo el Sistema en tu navegador...
start "" "http://localhost:8000"
echo.
echo ===================================================================
echo  SISTEMA ACTIVO!
echo  URL: http://localhost:8000
echo.
echo  Credenciales de Acceso por Rol (RBAC):
echo  - Administrador : admin@melidan.com    / password123 (Acceso Total)
echo  - Cocinero/Chef : chef@melidan.com     / password123 (Solo Cocina KDS)
echo  - Mozo / Salon  : carlos.p@melidan.com / password123 (Solo Carta QR y Tracker)
echo  - Mozo / Salon  : maria.s@melidan.com  / password123 (Solo Carta QR y Tracker)
echo  - Cajera / Caja : caja@melidan.com     / password123 (Solo Tracker y Carta)
echo ===================================================================
echo Para detener el servidor, cierra esta ventana.
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title Melidan Web - Servidor Activo

:: Configuracion directa PostgreSQL (usuario: postgres / clave: root)
set "PORT=8000"
set "DB_HOST=localhost"
set "DB_PORT=5432"
set "DB_NAME=melidan_db"
set "DB_USER=postgres"
set "DB_PASSWORD=root"

if not exist ".env" (
    (
        echo PORT=8000
        echo DB_HOST=localhost
        echo DB_PORT=5432
        echo DB_NAME=melidan_db
        echo DB_USER=postgres
        echo DB_PASSWORD=root
    ) > ".env"
)

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js no esta instalado o no figura en PATH.
    pause
    exit /b 1
)

if not exist "node_modules\express" (
    echo Configurando dependencias de Node.js por primera vez...
    call npm install --no-audit --no-fund --silent
)

:: Asegurar que el servicio PostgreSQL este iniciado (sin tocar datos de la base)
sc query postgresql-x64-18 2>nul | findstr /I "RUNNING" >nul
if errorlevel 1 net start postgresql-x64-18 >nul 2>&1

:: Liberar instancia previa en el puerto 8000 si existiera
for /f "tokens=5" %%P in ('netstat -aon ^| findstr ":8000 " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%P >nul 2>&1
)

echo Iniciando Melidan Web y conectando con PostgreSQL (melidan_db)...
start /B "" node "src/server.js"

set /a RETRIES=0
:WAIT_SERVER
"%SystemRoot%\System32\curl.exe" -fsS "http://127.0.0.1:8000/api/health" >nul 2>&1
if not errorlevel 1 goto :OPEN_CHROME
set /a RETRIES+=1
if %RETRIES% geq 20 goto :OPEN_CHROME
ping -n 2 127.0.0.1 >nul
goto :WAIT_SERVER

:OPEN_CHROME
set "LOGIN_URL=http://localhost:8000/login"
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%LOGIN_URL%"
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%LOGIN_URL%"
) else if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
    start "" "%LocalAppData%\Google\Chrome\Application\chrome.exe" "%LOGIN_URL%"
) else (
    start "" "%LOGIN_URL%"
)

echo Listo: Login abierto en Google Chrome (%LOGIN_URL%).
echo Manten esta ventana abierta mientras uses la web. Cierrala para detener el servidor.
pause >nul
