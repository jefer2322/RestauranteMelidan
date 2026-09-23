/**
 * Database.js - Clase simuladora de Base de Datos para Melidan
 * 
 * Simula una base de datos relacional/documental con colecciones, operaciones CRUD asíncronas,
 * simulación de latencia de red, hashing criptográfico de contraseñas, semillas por defecto,
 * y persistencia en LocalStorage.
 */

import { StorageAdapter } from './StorageAdapter.js';
import { CryptoUtil } from '../utils/CryptoUtil.js';

export class Database {
  /**
   * @param {Object} options Opciones de configuración del motor de base de datos
   * @param {string} options.dbName Nombre de la base de datos
   * @param {number} options.latencyMs Tiempo simulado de respuesta de red en milisegundos
   * @param {boolean} options.simulateLatency Si debe o no retrasar artificialmente las respuestas
   */
  constructor(options = {}) {
    this.dbName = options.dbName || 'melidan_db';
    this.latencyMs = options.latencyMs !== undefined ? options.latencyMs : 250;
    this.simulateLatency = options.simulateLatency !== undefined ? options.simulateLatency : true;
    
    this.storage = new StorageAdapter(`db_${this.dbName}_`);
    this.collections = ['users', 'roles', 'sessions', 'audit_logs', 'password_resets'];
    this.initialized = false;
  }

  /**
   * Retardo simulado para emular llamadas asíncronas a una API o base de datos real
   * @private
   */
  async delay(ms = null) {
    if (!this.simulateLatency) return;
    const waitTime = ms !== null ? ms : this.latencyMs;
    return new Promise(resolve => setTimeout(resolve, waitTime));
  }

  /**
   * Inicializa la base de datos cargando datos existentes o sembrando los datos iniciales
   * @returns {Promise<Database>}
   */
  async init() {
    if (this.initialized) return this;

    // Verificar si ya existen colecciones inicializadas
    const existingUsers = this.storage.getItem('users');
    if (!existingUsers || !Array.isArray(existingUsers) || existingUsers.length === 0) {
      await this.seedDefaultData();
    }

    this.initialized = true;
    console.log(`[Database] '${this.dbName}' inicializada y lista para operaciones.`);
    return this;
  }

  /**
   * Siembra los datos iniciales de roles y usuarios de prueba
   */
  async seedDefaultData() {
    console.log('[Database] Sembrando datos iniciales del sistema Melidan...');

    // 1. Roles del Sistema
    const defaultRoles = [
      {
        id: 'role_admin',
        code: 'ADMIN',
        name: 'Administrador / Dueño',
        description: 'Control total de la gestión gastronómica, personal, ventas y configuración.',
        permissions: ['*']
      },
      {
        id: 'role_chef',
        code: 'CHEF',
        name: 'Jefe de Cocina / KDS',
        description: 'Gestión de comandas, cambio de estados en pantalla de cocina KDS.',
        permissions: ['kds:view', 'kds:update_status', 'inventory:view']
      },
      {
        id: 'role_waiter',
        code: 'WAITER',
        name: 'Mozo / Salón',
        description: 'Toma de pedidos en mesa, monitoreo de estado de platos y atención al comensal.',
        permissions: ['tables:view', 'tables:occupy', 'orders:create', 'orders:view']
      },
      {
        id: 'role_cashier',
        code: 'CASHIER',
        name: 'Cajero / Facturación',
        description: 'Cierre de cuentas, cobro digital y emisión de boletas/facturas.',
        permissions: ['billing:close_account', 'billing:view_reports', 'tables:view']
      },
      {
        id: 'role_diner',
        code: 'DINER',
        name: 'Comensal Digital',
        description: 'Acceso autónomo a carta QR, envío de órdenes y seguimiento en vivo.',
        permissions: ['menu:view', 'orders:create_self', 'tracker:view']
      }
    ];

    // 2. Usuarios Iniciales con Salts y Contraseñas Hasheadas
    const usersToSeed = [
      {
        id: 'usr_001',
        name: 'Don Roberto',
        email: 'admin@melidan.com',
        plainPassword: 'password123',
        role: 'ADMIN',
        phone: '+51 987 654 321',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
        status: 'active'
      },
      {
        id: 'usr_002',
        name: 'Marco Antonio (Chef)',
        email: 'chef@melidan.com',
        plainPassword: 'password123',
        role: 'CHEF',
        phone: '+51 912 345 678',
        avatar: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=150&q=80',
        status: 'active'
      },
      {
        id: 'usr_003',
        name: 'Carlos Paredes',
        email: 'carlos.p@melidan.com',
        plainPassword: 'password123',
        role: 'WAITER',
        phone: '+51 999 111 222',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
        status: 'active'
      },
      {
        id: 'usr_004',
        name: 'María Salazar',
        email: 'maria.s@melidan.com',
        plainPassword: 'password123',
        role: 'CASHIER',
        phone: '+51 999 333 444',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
        status: 'active'
      }
    ];

    const seededUsers = [];
    const nowIso = new Date().toISOString();

    for (const u of usersToSeed) {
      const salt = CryptoUtil.generateSalt(16);
      const passwordHash = await CryptoUtil.hashPassword(u.plainPassword, salt);
      seededUsers.push({
        id: u.id,
        name: u.name,
        email: u.email.toLowerCase().trim(),
        salt,
        passwordHash,
        role: u.role,
        phone: u.phone,
        avatar: u.avatar,
        status: u.status,
        failedAttempts: 0,
        lockUntil: null,
        createdAt: nowIso,
        updatedAt: nowIso,
        lastLoginAt: null
      });
    }

    // Guardar colecciones iniciales
    this.storage.setItem('roles', defaultRoles);
    this.storage.setItem('users', seededUsers);
    this.storage.setItem('sessions', []);
    this.storage.setItem('audit_logs', [
      {
        id: 'log_seed_01',
        eventType: 'SYSTEM_INITIALIZED',
        userId: 'system',
        email: 'system@melidan.com',
        timestamp: nowIso,
        details: 'Base de datos simulada inicializada con usuarios y roles de prueba.',
        status: 'SUCCESS'
      }
    ]);
    this.storage.setItem('password_resets', []);
  }

  /**
   * Obtiene la lista completa de documentos de una colección
   * @private
   */
  getCollection(name) {
    return this.storage.getItem(name, []);
  }

  /**
   * Guarda la lista de documentos en una colección
   * @private
   */
  saveCollection(name, data) {
    this.storage.setItem(name, data);
  }

  /**
   * Evalúa si un documento cumple con el criterio de búsqueda
   * @private
   */
  matchesQuery(doc, query) {
    if (typeof query === 'function') {
      return query(doc);
    }
    if (!query || Object.keys(query).length === 0) {
      return true;
    }
    return Object.entries(query).every(([key, val]) => {
      if (typeof val === 'string' && typeof doc[key] === 'string') {
        return doc[key].toLowerCase() === val.toLowerCase();
      }
      return doc[key] === val;
    });
  }

  // ==========================================
  // OPERACIONES CRUD ASÍNCRONAS
  // ==========================================

  /**
   * Busca documentos en una colección que coincidan con la consulta
   * @param {string} collectionName Nombre de la colección
   * @param {Object|Function} query Filtro de coincidencia
   * @returns {Promise<Array>} Lista de documentos coincidentes (clonados)
   */
  async find(collectionName, query = {}) {
    await this.init();
    await this.delay();

    const items = this.getCollection(collectionName);
    const results = items.filter(doc => this.matchesQuery(doc, query));
    return JSON.parse(JSON.stringify(results));
  }

  /**
   * Busca el primer documento que coincida con la consulta
   * @param {string} collectionName Nombre de la colección
   * @param {Object|Function} query Filtro de coincidencia
   * @returns {Promise<Object|null>} Documento coincidente o null
   */
  async findOne(collectionName, query = {}) {
    await this.init();
    await this.delay();

    const items = this.getCollection(collectionName);
    const item = items.find(doc => this.matchesQuery(doc, query));
    return item ? JSON.parse(JSON.stringify(item)) : null;
  }

  /**
   * Busca un documento directamente por su ID primario
   * @param {string} collectionName
   * @param {string|number} id
   * @returns {Promise<Object|null>}
   */
  async findById(collectionName, id) {
    return this.findOne(collectionName, { id });
  }

  /**
   * Inserta un nuevo documento en la colección
   * @param {string} collectionName
   * @param {Object} doc Datos del documento a insertar
   * @returns {Promise<Object>} Documento creado con ID y fechas
   */
  async insert(collectionName, doc) {
    await this.init();
    await this.delay();

    const items = this.getCollection(collectionName);
    const nowIso = new Date().toISOString();

    const newDoc = {
      ...doc,
      id: doc.id || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      createdAt: doc.createdAt || nowIso,
      updatedAt: nowIso
    };

    items.push(newDoc);
    this.saveCollection(collectionName, items);

    return JSON.parse(JSON.stringify(newDoc));
  }

  /**
   * Actualiza documentos que coincidan con la consulta
   * @param {string} collectionName
   * @param {Object|Function} query Criterio de búsqueda
   * @param {Object} updateFields Campos a modificar o agregar
   * @returns {Promise<{updatedCount: number, modifiedDocs: Array}>}
   */
  async update(collectionName, query, updateFields) {
    await this.init();
    await this.delay();

    const items = this.getCollection(collectionName);
    let updatedCount = 0;
    const modifiedDocs = [];
    const nowIso = new Date().toISOString();

    const updatedItems = items.map(doc => {
      if (this.matchesQuery(doc, query)) {
        updatedCount++;
        const updated = {
          ...doc,
          ...updateFields,
          id: doc.id, // Preservar ID inmutable
          createdAt: doc.createdAt, // Preservar creación
          updatedAt: nowIso
        };
        modifiedDocs.push(updated);
        return updated;
      }
      return doc;
    });

    if (updatedCount > 0) {
      this.saveCollection(collectionName, updatedItems);
    }

    return {
      updatedCount,
      modifiedDocs: JSON.parse(JSON.stringify(modifiedDocs))
    };
  }

  /**
   * Elimina documentos que coincidan con la consulta
   * @param {string} collectionName
   * @param {Object|Function} query Criterio de búsqueda
   * @returns {Promise<{deletedCount: number}>}
   */
  async delete(collectionName, query) {
    await this.init();
    await this.delay();

    const items = this.getCollection(collectionName);
    const filtered = items.filter(doc => !this.matchesQuery(doc, query));
    const deletedCount = items.length - filtered.length;

    if (deletedCount > 0) {
      this.saveCollection(collectionName, filtered);
    }

    return { deletedCount };
  }

  /**
   * Cuenta la cantidad de registros que cumplen con el filtro
   * @param {string} collectionName
   * @param {Object|Function} query
   * @returns {Promise<number>}
   */
  async count(collectionName, query = {}) {
    await this.init();
    await this.delay(10);
    const items = this.getCollection(collectionName);
    return items.filter(doc => this.matchesQuery(doc, query)).length;
  }

  /**
   * Restablece la base de datos a sus valores iniciales de fábrica
   * @returns {Promise<void>}
   */
  async resetDatabase() {
    this.storage.clear();
    this.initialized = false;
    await this.init();
    console.log('[Database] Base de datos restablecida a valores de fábrica.');
  }

  /**
   * Obtiene métricas del estado actual de la base de datos simulada
   */
  async getMetrics() {
    await this.init();
    return {
      users: (this.getCollection('users')).length,
      roles: (this.getCollection('roles')).length,
      sessions: (this.getCollection('sessions')).length,
      auditLogs: (this.getCollection('audit_logs')).length
    };
  }
}

// Instancia singleton por defecto para el sistema
export const db = new Database();
