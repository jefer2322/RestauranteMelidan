# Restaurante Melidan — Sistema Web Gastronómico

Aplicación web responsive (**PC + Móvil + Demo Móvil interactiva**) construida con **HTML5 + CSS3 + JavaScript**, **Node.js + Express** y **PostgreSQL 18 (`melidan_db`)**.

## Estructura del Proyecto

```text
RestauranteMelidan/
├── abrir_sistema.bat          # Arranque directo: configura entorno, conecta PostgreSQL y abre Chrome en /login
├── package.json               # Configuración Node.js y scripts
├── .env.example               # Plantilla de variables de entorno
├── src/                       # Backend modular Node.js + Express
│   ├── server.js              # Punto de entrada HTTP y rutas limpias (/login, /admin, /mozo, /cocina, /cajero)
│   ├── config/
│   │   └── db.js              # Pool de conexión PostgreSQL 18
│   ├── routes/
│   │   └── api.js             # Endpoints REST (/api/health, /auth, /staff, /products, /mesas, /orders, /dashboard, /billing)
│   └── utils/
│       └── validators.js      # Validaciones DNI / Pasaporte / CE, teléfonos y roles
├── public/                    # Frontend estático y PWA
│   ├── index.html             # Portal de Inicio de Sesión, Registro, Recuperación OTP y SPA por rol
│   ├── pages/                 # Módulos operativos independientes
│   │   ├── admin.html         # Dashboard Ejecutivo y CRUD de Personal (Soft Delete)
│   │   ├── mozo.html          # Control de 15 Mesas, Aforo y Toma de Comandas
│   │   ├── cocina.html        # Pantalla KDS en tiempo real por estaciones
│   │   └── cajero.html        # Punto de Venta (POS) y Comprobantes Electrónicos
│   ├── css/                   # Hojas de estilo modulares, animaciones y Modo Oscuro completo
│   ├── js/                    # Controladores cliente, tema oscuro y conmutador Demo Móvil / PC
│   ├── img/                   # Iconos PWA
│   ├── manifest.webmanifest   # Manifiesto Web App
│   └── sw.js                  # Service Worker (Network-First)
├── database/
│   └── init.sql               # Esquema de referencia PostgreSQL 18 (melidan_db)
├── docs/                      # Documentación complementaria e historial
├── prototipo/                 # Recursos de diseño inicial
└── tests/
    └── test_crud_validations.js # Suite de pruebas automatizadas (no destructiva)
```

## Inicio Rápido (Windows)

Ejecuta **`abrir_sistema.bat`** con doble clic:
1. Configura automáticamente la conexión a PostgreSQL (`postgres` / `root`, base `melidan_db`).
2. Verifica dependencias y levanta el servidor Express en `http://localhost:8000`.
3. Abre **Google Chrome** directamente en **`http://localhost:8000/login`**.

### Comandos NPM

```bash
npm start   # Inicia el servidor en http://localhost:8000/login
npm test    # Ejecuta la suite de pruebas automatizadas
```
