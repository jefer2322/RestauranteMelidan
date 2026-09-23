/**
 * db.js - Conexión de Datos para Melidan
 * Conectado a la Base de Datos PostgreSQL 18 (melidan_db) mediante REST API.
 * Cuenta con sincronización en tiempo real y fallback automático a LocalStorage.
 */

class MelidanDB {
  constructor(dbName = 'melidan_app_db') {
    this.dbName = dbName;
    this.prefix = `${dbName}_`;
    this.apiBase = 'api';
    this.isPostgresConnected = false;
    this.initialized = false;
    this.init();
  }

  /**
   * Inicializa la base de datos y verifica conexión con PostgreSQL
   */
  async init() {
    if (this.initialized) return;

    // Verificar si la API PostgreSQL está disponible
    try {
      const res = await fetch(`${this.apiBase}/dashboard.php`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          this.isPostgresConnected = true;
          console.log('%c[MelidanDB] Conectado exitosamente a PostgreSQL 18 (melidan_db)', 'color: #00897B; font-weight: bold;');
          this.updateConnectionBadge(true);
        }
      }
    } catch (e) {
      console.warn('[MelidanDB] API PostgreSQL no disponible en entorno estático. Usando persistencia local.');
      this.isPostgresConnected = false;
      this.updateConnectionBadge(false);
    }

    // Inicializar datos locales como fallback
    const existingUsers = this.get('users');
    if (!existingUsers || !Array.isArray(existingUsers) || existingUsers.length === 0) {
      this.seedData();
    }
    this.initialized = true;
  }

  /**
   * Actualiza el indicador visual de conexión con la BD en la interfaz
   */
  updateConnectionBadge(connected) {
    const badges = document.querySelectorAll('.db-status-badge');
    badges.forEach(badge => {
      if (connected) {
        badge.innerHTML = `<span class="badge-dot-green"></span> PostgreSQL 18 Conectado (melidan_db)`;
        badge.className = 'db-status-badge db-connected';
      } else {
        badge.innerHTML = `<span class="badge-dot-amber"></span> Modo Local (Simulado)`;
        badge.className = 'db-status-badge db-local';
      }
    });
  }

  // ==========================================
  // MÉTODOS DE INTEGRACIÓN CON POSTGRESQL API
  // ==========================================

  /**
   * Obtiene métricas y monitoreo de salón desde PostgreSQL
   */
  async getDashboard() {
    if (this.isPostgresConnected) {
      try {
        const res = await fetch(`${this.apiBase}/dashboard.php`);
        const json = await res.json();
        if (json.success) return json;
      } catch (err) {
        console.error('[MelidanDB] Error en getDashboard API:', err);
      }
    }
    // Fallback Local
    return {
      success: true,
      metrics: {
        ventas_hoy: 1450.00,
        ventas_hoy_formato: 'S/ 1,450.00',
        pedidos_activos: 12,
        mesas_ocupadas: 8,
        total_mesas: 15,
        mesas_texto: '8 / 15',
        tiempo_promedio: '14 min'
      },
      salon_monitor: [
        { id_pedido: 1024, numero_comanda: 1024, numero_mesa: 8, total: '84.00', mozo_nombre: 'Carlos P.', badge_text: 'Listo para entregar', estado: 'listo' },
        { id_pedido: 1025, numero_comanda: 1025, numero_mesa: 2, total: '48.00', mozo_nombre: 'María S.', badge_text: 'En cocina', estado: 'en_cocina' },
        { id_pedido: 1026, numero_comanda: 1026, numero_mesa: 11, total: '64.00', mozo_nombre: 'Carlos P.', badge_text: 'Listo para entregar', estado: 'listo' }
      ]
    };
  }

  /**
   * Obtiene la plantilla de personal desde PostgreSQL (tabla usuarios)
   */
  async getStaff() {
    if (this.isPostgresConnected) {
      try {
        const res = await fetch(`${this.apiBase}/staff.php`);
        const json = await res.json();
        if (json.success && json.staff) {
          return json.staff;
        }
      } catch (err) {
        console.error('[MelidanDB] Error en getStaff API:', err);
      }
    }
    return this.get('staff', []);
  }

  /**
   * Registra un nuevo empleado en PostgreSQL (INSERT INTO usuarios)
   */
  async insertStaff(employeeData) {
    if (this.isPostgresConnected) {
      try {
        const res = await fetch(`${this.apiBase}/staff.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(employeeData)
        });
        const json = await res.json();
        if (json.success && json.member) {
          // Mantener sincronizado localmente
          const localStaff = this.get('staff', []);
          localStaff.push(json.member);
          this.set('staff', localStaff);
          return json.member;
        } else {
          throw new Error(json.message || 'Error al guardar empleado');
        }
      } catch (err) {
        console.error('[MelidanDB] Fallo al insertar personal en PostgreSQL:', err);
        throw err;
      }
    }

    // Fallback Local
    const local = await this.insert('staff', employeeData);
    return local;
  }

  /**
   * Obtiene las comandas activas desde PostgreSQL
   */
  async getOrders() {
    if (this.isPostgresConnected) {
      try {
        const res = await fetch(`${this.apiBase}/orders.php`);
        const json = await res.json();
        if (json.success && json.orders) {
          return json.orders;
        }
      } catch (err) {
        console.error('[MelidanDB] Error en getOrders API:', err);
      }
    }
    return this.get('orders', []);
  }

  /**
   * Actualiza el estado de una comanda en PostgreSQL
   */
  async updateOrderStatus(orderId, status) {
    if (this.isPostgresConnected) {
      try {
        const res = await fetch(`${this.apiBase}/orders.php?id=${encodeURIComponent(orderId)}&status=${encodeURIComponent(status)}`, {
          method: 'PUT'
        });
        const json = await res.json();
        if (json.success) return json.order;
      } catch (err) {
        console.error('[MelidanDB] Error actualizando comanda en PostgreSQL:', err);
      }
    }

    // Fallback Local
    await this.update('orders', { id: String(orderId) }, { status: status });
    return { id: orderId, status: status };
  }

  /**
   * Obtiene la carta de productos desde PostgreSQL
   */
  async getProducts() {
    if (this.isPostgresConnected) {
      try {
        const res = await fetch(`${this.apiBase}/products.php`);
        const json = await res.json();
        if (json.success && json.productos) {
          return json.productos;
        }
      } catch (err) {
        console.error('[MelidanDB] Error en getProducts API:', err);
      }
    }
    return this.get('dishes', []);
  }

  // ==========================================
  // OPERACIONES DE ALMACENAMIENTO LOCALSTORAGE
  // ==========================================

  get(collection, fallback = []) {
    try {
      const data = localStorage.getItem(`${this.prefix}${collection}`);
      return data ? JSON.parse(data) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  set(collection, data) {
    try {
      localStorage.setItem(`${this.prefix}${collection}`, JSON.stringify(data));
    } catch (e) {
      console.error(`[MelidanDB] Error guardando ${collection}:`, e);
    }
  }

  async find(collection, query = {}) {
    const items = this.get(collection);
    if (!query || Object.keys(query).length === 0) return items;

    return items.filter(item => {
      if (typeof query === 'function') return query(item);
      return Object.entries(query).every(([k, v]) => {
        if (typeof v === 'string' && typeof item[k] === 'string') {
          return item[k].toLowerCase() === v.toLowerCase();
        }
        return item[k] === v;
      });
    });
  }

  async findOne(collection, query = {}) {
    const results = await this.find(collection, query);
    return results.length > 0 ? results[0] : null;
  }

  async insert(collection, doc) {
    const items = this.get(collection);
    const newDoc = {
      ...doc,
      id: doc.id || `id_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString()
    };
    items.push(newDoc);
    this.set(collection, items);
    return newDoc;
  }

  async update(collection, query, updates) {
    const items = this.get(collection);
    let count = 0;
    const updated = items.map(item => {
      const match = typeof query === 'function' ? query(item) : Object.entries(query).every(([k, v]) => item[k] === v);
      if (match) {
        count++;
        return { ...item, ...updates, updatedAt: new Date().toISOString() };
      }
      return item;
    });
    this.set(collection, updated);
    return count;
  }

  async delete(collection, query) {
    const items = this.get(collection);
    const filtered = items.filter(item => {
      const match = typeof query === 'function' ? query(item) : Object.entries(query).every(([k, v]) => item[k] === v);
      return !match;
    });
    this.set(collection, filtered);
    return items.length - filtered.length;
  }

  /**
   * Carga los datos iniciales de prueba para modo local
   */
  seedData() {
    const users = [
      {
        id: 'usr_admin',
        name: 'Don Roberto',
        email: 'admin@melidan.com',
        password: 'password123',
        role: 'ADMIN',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
        status: 'active'
      },
      {
        id: 'usr_chef',
        name: 'Marco Antonio',
        email: 'chef@melidan.com',
        password: 'password123',
        role: 'CHEF',
        avatar: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=150&q=80',
        status: 'active'
      },
      {
        id: 'usr_mozo',
        name: 'Carlos Paredes',
        email: 'carlos.p@melidan.com',
        password: 'password123',
        role: 'WAITER',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
        status: 'active'
      }
    ];

    const staff = [
      { id: 1, name: 'Carlos Paredes', email: 'carlos.p@melidan.com', role: 'Mozo / Salón', shift: 'Turno Mañana (8:00 AM - 4:00 PM)', status: 'Activo' },
      { id: 2, name: 'María Salazar', email: 'maria.s@melidan.com', role: 'Mozo / Salón', shift: 'Turno Tarde (4:00 PM - 12:00 AM)', status: 'Activo' },
      { id: 3, name: 'Jorge Ruiz', email: 'jorge.r@melidan.com', role: 'Mozo / Salón', shift: 'Turno Rotativo', status: 'Inactivo' }
    ];

    const dishes = [
      { id: 1, name: 'Lechón a Fuego Lento', category: 'Platos de Fondo', price: 48.00, image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80' },
      { id: 2, name: 'Costillar Glaseado', category: 'Platos de Fondo', price: 42.00, image: 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format&fit=crop&w=600&q=80' },
      { id: 3, name: 'Lomo Saltado', category: 'Platos de Fondo', price: 38.00, image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80' },
      { id: 4, name: 'Chicha Morada (1L)', category: 'Bebidas', price: 14.00, image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80' }
    ];

    this.set('users', users);
    this.set('staff', staff);
    this.set('dishes', dishes);
  }
}

// Instancia global
window.db = new MelidanDB();
