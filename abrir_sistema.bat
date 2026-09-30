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
pause >nul
