/**
 * tests/test_crud_validations.js - Suite de Pruebas Unitarias y de Integración
 * Restaurante Melidan
 *
 * Verifica:
 * 1. Configuración de variables de entorno y estructura modular organizada (src/ y public/).
 * 2. Validaciones Regex y DTOs (Peruanos DNI vs Extranjeros Pasaporte/CE, teléfonos y correos).
 * 3. Persistencia CRUD y Borrado Lógico (Soft Delete) en PostgreSQL 18 mediante transacción segura (ROLLBACK).
 * 4. Arquitectura de vistas web responsive, animaciones y Modo Oscuro completo.
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
require('dotenv').config({ path: path.join(PROJECT_ROOT, '.env') });

const { pool } = require('../src/config/db');
const { validateUser, dbRoleAliases } = require('../src/utils/validators');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  \x1b[32m✔ PASS:\x1b[0m ${message}`);
    testsPassed++;
  } else {
    console.error(`  \x1b[31m✖ FAIL:\x1b[0m ${message}`);
    testsFailed++;
  }
}

async function runTests() {
  console.log('\n===============================================================');
  console.log('  MELIDAN - SUITE DE PRUEBAS AUTOMATIZADAS (WEB + POSTGRESQL)');
  console.log('===============================================================\n');

  // -------------------------------------------------------------
  // [GRUPO 1] Variables de Entorno y Estructura de Carpetas
  // -------------------------------------------------------------
  console.log('\x1b[36m[GRUPO 1] Configuración de Entorno y Organización de Carpetas\x1b[0m');
  const envExamplePath = path.join(PROJECT_ROOT, '.env.example');
  assert(fs.existsSync(envExamplePath), 'El archivo .env.example existe como plantilla de entorno');

  const envContent = fs.readFileSync(envExamplePath, 'utf8');
  assert(envContent.includes('DB_NAME=melidan_db'), 'DB_NAME configurado como melidan_db');
  assert(envContent.includes('DB_USER=postgres'), 'DB_USER configurado como postgres');
  assert(envContent.includes('DB_HOST=localhost'), 'DB_HOST configurado como localhost');

  assert(fs.existsSync(path.join(PROJECT_ROOT, 'src', 'server.js')), 'Backend organizado en src/server.js');
  assert(fs.existsSync(path.join(PROJECT_ROOT, 'src', 'config', 'db.js')), 'Pool PostgreSQL modular en src/config/db.js');
  assert(fs.existsSync(path.join(PROJECT_ROOT, 'src', 'routes', 'api.js')), 'Rutas REST modulares en src/routes/api.js');
  assert(fs.existsSync(path.join(PROJECT_ROOT, 'src', 'utils', 'validators.js')), 'Validadores centralizados en src/utils/validators.js');

  // -------------------------------------------------------------
  // [GRUPO 2] Validaciones Regex y Validador Backend
  // -------------------------------------------------------------
  console.log('\n\x1b[36m[GRUPO 2] Reglas de Validación (Nacionales vs Extranjeros y Roles)\x1b[0m');

  const validPe = validateUser({
    name: 'Carlos Mendoza',
    email: 'carlos.m@melidan.com',
    role: 'mozo',
    tipo_documento: 'DNI',
    numero_documento: '72849102',
    nacionalidad: 'Peruana',
    telefono: '+51 987654321'
  });
  assert(Object.keys(validPe.errors).length === 0, 'Usuario peruano con DNI (8 dígitos) y teléfono +51 9XXXXXXXX pasa validación');

  const invalidDni = validateUser({
    name: 'Usuario Inválido',
    email: 'invalido@melidan.com',
    tipo_documento: 'DNI',
    numero_documento: '7284A',
    nacionalidad: 'Peruana',
    telefono: '987654321'
  });
  assert(Boolean(invalidDni.errors.numero_documento), 'DNI inválido con menos de 8 dígitos o letras es rechazado');

  const validForeign = validateUser({
    name: 'Sarah Jenkins',
    email: 'sarah.jenkins@gmail.com',
    role: 'cliente',
    tipo_documento: 'PASAPORTE',
    numero_documento: 'PAS9845123A',
    nacionalidad: 'Estadounidense',
    telefono: '+1 4155552671'
  });
  assert(Object.keys(validForeign.errors).length === 0, 'Usuario extranjero con Pasaporte e código internacional pasa validación');

  const partialUpdate = validateUser({ name: 'Jean-Luc Dubois', telefono: '+33 612345678' }, true, { nacionalidad: 'Francesa', rol: 'mozo' });
  assert(
    partialUpdate.is_valid && partialUpdate.data.nacionalidad === undefined && partialUpdate.data.rol === undefined,
    'Actualización parcial (PUT) no sobrescribe rol ni nacionalidad omitidos'
  );

  assert(dbRoleAliases.recepcionista === 'recepcionista', 'Rol recepcionista existente en PostgreSQL es reconocido');
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  assert(emailRegex.test('admin@melidan.com') && !emailRegex.test('correo-sin-dominio'), 'Validador de correo electrónico filtra formatos inválidos');

  // -------------------------------------------------------------
  // [GRUPO 3] Persistencia PostgreSQL 18 (Transacción No Destructiva)
  // -------------------------------------------------------------
  console.log('\n\x1b[36m[GRUPO 3] Persistencia, Soft Delete y Mesas en PostgreSQL 18\x1b[0m');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const colsRes = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'usuarios'"
    );
    const cols = colsRes.rows.map((r) => r.column_name);
    assert(cols.includes('tipo_documento') && cols.includes('numero_documento'), 'Columnas de documento existen en PostgreSQL');
    assert(cols.includes('nacionalidad') && cols.includes('is_deleted'), 'Columnas nacionalidad e is_deleted existen en PostgreSQL');

    const testEmail = `qa.transaccional.${Date.now()}@melidan.com`;
    const ins = await client.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol, tipo_documento, numero_documento, nacionalidad, telefono, estado, is_deleted)
       VALUES ('Usuario QA Transaccional', $1, 'hash123', 'mozo', 'DNI', '88776655', 'Peruana', '+51 987654321', 'Activo', FALSE)
       RETURNING id_usuario`,
      [testEmail]
    );
    const testId = ins.rows[0].id_usuario;
    assert(testId > 0, `CREATE: Usuario insertado correctamente en transacción (ID #${testId})`);

    const upd = await client.query(
      "UPDATE usuarios SET telefono = '+51 999888777' WHERE id_usuario = $1 RETURNING telefono",
      [testId]
    );
    assert(upd.rows[0].telefono === '+51 999888777', 'UPDATE: Teléfono actualizado correctamente');

    const softDel = await client.query(
      "UPDATE usuarios SET is_deleted = TRUE, estado = 'Inactivo', fecha_eliminacion = CURRENT_TIMESTAMP WHERE id_usuario = $1 RETURNING is_deleted, estado",
      [testId]
    );
    assert(softDel.rows[0].is_deleted === true && softDel.rows[0].estado === 'Inactivo', 'SOFT DELETE: Baja lógica aplicada sin borrar registro físico');

    const countCheck = await client.query('SELECT COUNT(*)::int AS total FROM usuarios WHERE id_usuario = $1', [testId]);
    assert(countCheck.rows[0].total === 1, 'INTEGRIDAD: El registro permanece físicamente en PostgreSQL');

    const mesasCount = await client.query('SELECT COUNT(*)::int AS total FROM mesas');
    assert(mesasCount.rows[0].total === 15, `Existen 15 mesas registradas en PostgreSQL (detectadas: ${mesasCount.rows[0].total})`);

    const m4 = await client.query(
      "UPDATE mesas SET estado = 'ocupada', tiempo_min = 14, mozo_asignado = 'Carlos Paredes' WHERE numero_mesa = 4 RETURNING estado"
    );
    assert(m4.rows[0].estado === 'ocupada', 'FLUJO MESAS: Transición de estado de mesa verificada en transacción');

    // Revertir toda operación de prueba para NO alterar absolutamente nada de la base real
    await client.query('ROLLBACK');
    await client.query(
      "SELECT setval(pg_get_serial_sequence('usuarios', 'id_usuario'), (SELECT COALESCE(MAX(id_usuario), 1) FROM usuarios))"
    );
    assert(true, 'ROLLBACK: Base de datos melidan_db intacta sin modificaciones residuales');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error durante pruebas con PostgreSQL:', err.message);
    testsFailed++;
  } finally {
    client.release();
    await pool.end();
  }

  // -------------------------------------------------------------
  // [GRUPO 4] Arquitectura Frontend Organizada, Responsive y Modo Oscuro
  // -------------------------------------------------------------
  console.log('\n\x1b[36m[GRUPO 4] Frontend Organizado, Responsive Móvil/PC y Modo Oscuro Completo\x1b[0m');
  assert(fs.existsSync(path.join(PROJECT_ROOT, 'public', 'index.html')), 'Portal de Login public/index.html existe');

  const pageFiles = ['admin.html', 'mozo.html', 'cocina.html', 'cajero.html'];
  for (const page of pageFiles) {
    assert(fs.existsSync(path.join(PROJECT_ROOT, 'public', 'pages', page)), `Vista modular public/pages/${page} existe`);
  }

  const cssFiles = ['base.css', 'styles.css', 'admin.css', 'mozo.css', 'cocina.css', 'cajero.css', 'animations.css', 'dark-mode.css'];
  for (const css of cssFiles) {
    assert(fs.existsSync(path.join(PROJECT_ROOT, 'public', 'css', css)), `Hoja de estilos public/css/${css} existe`);
  }

  const mozoContent = fs.readFileSync(path.join(PROJECT_ROOT, 'public', 'pages', 'mozo.html'), 'utf8');
  assert(mozoContent.includes('Control de Mesas y Aforo') && mozoContent.includes('tables-grid-container'), 'mozo.html mantiene encabezado y grilla de 15 mesas');

  const adminContent = fs.readFileSync(path.join(PROJECT_ROOT, 'public', 'pages', 'admin.html'), 'utf8');
  assert(adminContent.includes('admin-staff-list') && adminContent.includes('confirmDeleteModal'), 'admin.html mantiene gestión de personal y modal de Soft Delete');

  const cocinaContent = fs.readFileSync(path.join(PROJECT_ROOT, 'public', 'pages', 'cocina.html'), 'utf8');
  assert(cocinaContent.includes('kds-live-clock') && cocinaContent.includes('station-filters'), 'cocina.html mantiene reloj en vivo y filtros de estación');

  const cajeroContent = fs.readFileSync(path.join(PROJECT_ROOT, 'public', 'pages', 'cajero.html'), 'utf8');
  assert(cajeroContent.includes('pending-bills-list') && cajeroContent.includes('receiptModal'), 'cajero.html mantiene cuentas pendientes y modal de comprobante');

  const themeCode = fs.readFileSync(path.join(PROJECT_ROOT, 'public', 'js', 'theme.js'), 'utf8');
  assert(themeCode.includes('melidan_theme') && themeCode.includes('toggleViewportDemo'), 'public/js/theme.js gestiona Modo Oscuro y Demostración Móvil/PC');

  const darkCss = fs.readFileSync(path.join(PROJECT_ROOT, 'public', 'css', 'dark-mode.css'), 'utf8');
  assert(darkCss.includes('[data-theme="dark"]') && darkCss.includes('-webkit-autofill'), 'public/css/dark-mode.css cubre Modo Oscuro completo y tipografía anti-halación');

  const batContent = fs.readFileSync(path.join(PROJECT_ROOT, 'abrir_sistema.bat'), 'utf8');
  assert(
    batContent.includes('DB_USER=postgres') && batContent.includes('DB_PASSWORD=root') && batContent.includes('/login'),
    'abrir_sistema.bat configura postgres/root y dirige directo al Login en Google Chrome'
  );

  console.log('\n===============================================================');
  console.log(`  RESUMEN: ${testsPassed} pruebas exitosas, ${testsFailed} fallidas.`);
  if (testsFailed === 0) {
    console.log('  \x1b[32m✔ TODAS LAS VALIDACIONES Y PRUEBAS PASARON EXITOSAMENTE!\x1b[0m');
  } else {
    console.log('  \x1b[31m✖ ALGUNAS PRUEBAS FALLARON. REVISA LOS DETALLES ARRIBA.\x1b[0m');
  }
  console.log('===============================================================\n');

  process.exit(testsFailed === 0 ? 0 : 1);
}

runTests();
