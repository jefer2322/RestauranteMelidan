@echo off
title Melidan - Sistema Gastronomico con PostgreSQL
color 0A
echo ===================================================================
echo     MELIDAN - SISTEMA INTEGRAL DE CONTROL GASTRONOMICO
echo     Conectado a Base de Datos PostgreSQL 18 (melidan_db)
echo ===================================================================
echo.
echo [1/3] Verificando entorno PHP y PostgreSQL...
echo       - Motor BD: PostgreSQL 18 (localhost:5432)
echo       - Base de Datos: melidan_db
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
echo  Credenciales de Acceso:
echo  - Administrador : admin@melidan.com / password123
echo  - Cocina (KDS)  : chef@melidan.com  / password123
echo  - Mozo / Salon  : carlos.p@melidan.com / password123
echo ===================================================================
echo Para detener el servidor, cierra esta ventana.
pause >nul
