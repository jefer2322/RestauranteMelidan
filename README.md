# Melidan - Sistema de Gestión Gastronómica con PostgreSQL

Sistema integral para restaurantes (Administración, KDS de Cocina, Gestión de Personal, Carta Digital y Monitoreo de Salón) conectado a **PostgreSQL 18**.

---

## 🚀 Inicio Rápido

1. Haz doble clic en el archivo **`abrir_sistema.bat`**.
2. Se iniciará el servidor web local en `http://localhost:8000` y se abrirá automáticamente en tu navegador.
3. El sistema verificará de inmediato la conexión con PostgreSQL y mostrará el indicador verde: `🟢 PostgreSQL 18 Conectado (melidan_db)`.

---

## 🗄️ Credenciales y Configuración de Base de Datos

- **Motor:** PostgreSQL 18
- **Host / Puerto:** `localhost:5432`
- **Base de Datos:** `melidan_db`
- **Usuario:** `postgres`
- **Contraseña:** `root`
- **Archivo SQL de Inicialización:** [`database/init.sql`](database/init.sql)

---

## 👥 Control de Acceso por Roles (RBAC) en PostgreSQL

Todas las cuentas vienen configuradas con la contraseña **`password123`**:

| Usuario | Correo | Rol en BD | Apartado Permitido | Pestañas Visibles |
|---|---|---|---|---|
| **Marco Antonio (Chef)** | `chef@melidan.com` | `cocina` | **Solo Cocina KDS** | `Cocina`, `Salir` |
| **Carlos Paredes** | `carlos.p@melidan.com` | `mozo` | **Solo Salón (Carta QR y Tracker)** | `Carta QR`, `Tracker`, `Salir` |
| **María Salazar** | `maria.s@melidan.com` | `mozo` | **Solo Salón (Carta QR y Tracker)** | `Carta QR`, `Tracker`, `Salir` |
| **Lucía Ramos (Caja)** | `caja@melidan.com` | `cajero` | **Solo Facturación y Tracker** | `Tracker`, `Carta QR`, `Salir` |
| **Don Roberto** | `admin@melidan.com` | `administrador` | **Acceso Total** | `Admin`, `Personal`, `Cocina`, `Carta QR`, `Tracker`, `Salir` |

> 🔒 **Seguridad y Bloqueo de Rutas:** Si un mozo o cocinero intenta acceder a una sección no autorizada (por ejemplo el cocinero queriendo entrar a administración o a la carta), el sistema bloquea inmediatamente la navegación, muestra una advertencia emergente y lo devuelve a su apartado asignado.

## 📁 Arquitectura del Proyecto

```
Servicios/
├── database/
│   └── init.sql                 # Script SQL: Tablas, Enums, Constraints y Semillas
│
├── api/                         # Backend REST API conectado a PostgreSQL (PDO pgsql)
│   ├── config.php               # Conexión singleton a postgres / root @ melidan_db
│   ├── auth.php                 # Login, tokens de recuperación (OTP 6 dígitos) y cambio de clave
│   ├── staff.php                # CRUD de personal conectado a la tabla 'usuarios'
│   ├── orders.php               # Gestión y actualización de estados de comandas ('pedidos')
│   ├── dashboard.php            # Métricas en vivo (Ventas de hoy, mesas, salón)
│   └── products.php             # Carta digital y categorías ('productos', 'categorias')
│
├── js/
│   ├── db.js                    # Adaptador de base de datos con sincronización PostgreSQL y fallback
│   ├── auth.js                  # Servicio de autenticación conectado a /api/auth.php
│   └── app.js                   # Controlador SPA reactivo mobile-first
│
├── css/
│   └── styles.css               # Estilos mobile-first, diseño limpio y tokens
│
├── index.html                   # Interfaz única responsive con todas las pantallas
├── abrir_sistema.bat            # Ejecutable para iniciar servidor PHP y abrir navegador
└── prototipo/                   # Prototipo inicial preservado
```

---

## 🔌 Endpoints de la API REST

- `POST /api/auth.php?action=login` — Inicio de sesión con validación bcrypt.
- `POST /api/auth.php?action=request_reset` — Genera código numérico de 6 dígitos en `recuperacion_claves`.
- `POST /api/auth.php?action=reset_password` — Actualiza la contraseña en PostgreSQL.
- `GET /api/staff.php` — Lista todo el personal desde la tabla `usuarios`.
- `POST /api/staff.php` — Registra un nuevo empleado en la tabla `usuarios`.
- `GET /api/dashboard.php` — Métricas y comandas activas del salón.
- `GET /api/orders.php` — Lista de pedidos para cocina y salón.
- `PUT /api/orders.php?id={id}&status={estado}` — Cambia estado de comanda (`pendiente`, `en_cocina`, `listo`).
- `GET /api/products.php` — Platos de la carta y categorías.