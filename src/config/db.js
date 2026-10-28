/**
 * src/config/db.js - Configuración del Pool PostgreSQL 18 (melidan_db)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { Pool } = require('pg');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'melidan_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD ?? process.env.DB_PASS ?? 'root',
  max: 12,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
};

const pool = new Pool(dbConfig);

// Evitar caídas del proceso ante desconexiones inactivas del motor
pool.on('error', (err) => {
  console.error('[PostgreSQL Pool] Error inesperado en cliente inactivo:', err.message);
});

module.exports = { pool, dbConfig };

