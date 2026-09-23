/**
 * db.js - Clase simuladora de Base de Datos para Melidan
 * Estructura limpia y directa con persistencia en LocalStorage.
 * Lista para sustituir por una API / base de datos real (SQL/MongoDB/Firebase).
 */

class MelidanDB {
  constructor(dbName = 'melidan_app_db') {
    this.dbName = dbName;
    this.prefix = `${dbName}_`;
    this.initialized = false;
    this.init();
  }

  /**
   * Inicializa la base de datos y siembra datos iniciales si está vacía
   */
  init() {
    if (this.initialized) return;

    const existingUsers = this.get('users');
    if (!existingUsers || !Array.isArray(existingUsers) || existingUsers.length === 0) {
      this.seedData();
    }
    this.initialized = true;
  }

  /**
   * Carga los datos iniciales del sistema gastronómico
   */
  seedData() {
    // 1. Usuarios del sistema
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
      },
      {
        id: 'usr_caja',
        name: 'María Salazar',
        email: 'maria.s@melidan.com',
        password: 'password123',
        role: 'CASHIER',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
        status: 'active'
      }
    ];

    // 2. Plantilla de Personal (Captura 2)
    const staff = [
      {
        id: 'stf_01',
        name: 'Carlos Paredes',
        email: 'carlos.p@melidan.com',
        role: 'Mozo / Salón',
        shift: 'Turno Mañana (8:00 AM - 4:00 PM)',
        status: 'Activo'
      },
      {
        id: 'stf_02',
        name: 'María Salazar',
        email: 'maria.s@melidan.com',
        role: 'Mozo / Salón',
        shift: 'Turno Tarde (4:00 PM - 12:00 AM)',
        status: 'Activo'
      },
      {
        id: 'stf_03',
        name: 'Jorge Ruiz',
        email: 'jorge.r@melidan.com',
        role: 'Mozo / Salón',
        shift: 'Turno Rotativo',
        status: 'Inactivo'
      }
    ];

    // 3. Comandas y Monitoreo de Salón (Capturas 3 y 4)
    const orders = [
      {
        id: '1024',
        table: 'Mesa 08',
        client: 'Jorge R.',
        waiter: 'Carlos P.',
        total: 84.00,
        status: 'listo', // 'nuevos', 'cocinando', 'listo', 'entregado'
        statusLabel: 'Listo para entregar',
        time: '10:40',
        items: [
          { name: 'Lomo Saltado', qty: 1, note: 'SIN PECANAS (Alergia)' },
          { name: 'Chicha Morada Jarra', qty: 1, note: 'Bien fría' }
        ]
      },
      {
        id: '1025',
        table: 'Mesa 02',
        client: 'María S.',
        waiter: 'María S.',
        total: 120.00,
        status: 'cocinando',
        statusLabel: 'En cocina',
        time: '10:42',
        items: [
          { name: 'Arroz con Pato', qty: 2, note: 'Pierna bien dorada' },
          { name: 'Limonada Frozen', qty: 2, note: 'Hojas de menta' }
        ]
      },
      {
        id: '1026',
        table: 'Mesa 11',
        client: 'Pedro L.',
        waiter: 'Carlos P.',
        total: 45.00,
        status: 'cocinando',
        statusLabel: 'En cocina',
        time: '10:45',
        items: [
          { name: 'Causa Limeña', qty: 1, note: 'Sin picante' },
          { name: 'Limonada Frozen', qty: 1, note: '' }
        ]
      },
      {
        id: '1045',
        table: 'Mesa 04',
        client: 'María S.',
        waiter: 'Carlos P.',
        total: 52.00,
        status: 'cocinando',
        statusLabel: 'En cocina',
        time: '10:45',
        items: [
          { name: 'Arroz con Pato', qty: 1, note: '* Bien cocido' },
          { name: 'Causa Limeña', qty: 2, note: '' }
        ]
      },
      {
        id: '1046',
        table: 'Mesa 08',
        client: 'Jorge R.',
        waiter: 'Carlos P.',
        total: 28.00,
        status: 'nuevos',
        statusLabel: 'Nuevo pedido',
        time: '10:50',
        items: [
          { name: 'Lomo Saltado', qty: 1, note: '* SIN PECANAS (Alergia)' }
        ]
      }
    ];

    // 4. Carta de Platos (Captura 5)
    const dishes = [
      {
        id: 'dish_01',
        name: 'Lomo Saltado Clásico',
        category: 'Platos de Fondo',
        description: 'Trozos de lomo jugoso flameado al wok con cebolla, tomate, ají amarillo, servido con papas crujientes y arroz.',
        price: 28.00,
        popular: true,
        image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80'
      },
      {
        id: 'dish_02',
        name: 'Ají de Gallina',
        category: 'Platos de Fondo',
        description: 'Receta tradicional con crema de ají amarillo, pechuga deshilachada, nueces, huevo duro y aceituna botija.',
        price: 24.00,
        popular: true,
        image: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80'
      },
      {
        id: 'dish_03',
        name: 'Limonada Frozen',
        category: 'Bebidas',
        description: 'Bebida refrescante de limón licuada con hielo frapé y hojas de menta fresca.',
        price: 12.00,
        popular: true,
        image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80'
      },
      {
        id: 'dish_04',
        name: 'Causa Limeña de Pollo',
        category: 'Entradas',
        description: 'Masa suave de papa amarilla aliñada con ají amarillo y limón, rellena de pechuga y palta fuerte.',
        price: 18.00,
        popular: false,
        image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80'
      },
      {
        id: 'dish_05',
        name: 'Arroz con Pato Criollo',
        category: 'Platos de Fondo',
        description: 'Pierna de pato dorada con arroz al culantro y chicha de jora, acompañado de sarsa criolla.',
        price: 36.00,
        popular: false,
        image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80'
      },
      {
        id: 'dish_06',
        name: 'Chicha Morada Clásica',
        category: 'Bebidas',
        description: 'Refresco artesanal de maíz morado con piña, manzana, canela y clavo de olor (Vaso).',
        price: 10.00,
        popular: false,
        image: 'https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=600&q=80'
      }
    ];

    // 5. Métricas Generales del Restaurante (Captura 4)
    const metrics = {
      salesToday: 1450.00,
      activeOrders: 12,
      tablesOccupied: '8 / 15',
      avgTime: '14 min'
    };

    // Guardar colecciones en LocalStorage
    this.set('users', users);
    this.set('staff', staff);
    this.set('orders', orders);
    this.set('dishes', dishes);
    this.set('metrics', metrics);
    this.set('password_resets', []);
    this.set('cart', [
      { id: 'dish_05', name: 'Arroz con Pato', price: 36.00, qty: 1, note: 'Bien cocido' },
      { id: 'dish_04', name: 'Causa Limeña', price: 16.00, qty: 1, note: '' }
    ]);
  }

  // ==========================================
  // OPERACIONES DE ALMACENAMIENTO
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

  // ==========================================
  // MÉTODOS CRUD ASÍNCRONOS
  // ==========================================

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

  async findById(collection, id) {
    return this.findOne(collection, { id });
  }

  async insert(collection, doc) {
    const items = this.get(collection);
    const newDoc = {
      ...doc,
      id: doc.id || `id_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString()
    };
    items.unshift(newDoc);
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

  reset() {
    localStorage.removeItem(`${this.prefix}users`);
    localStorage.removeItem(`${this.prefix}staff`);
    localStorage.removeItem(`${this.prefix}orders`);
    localStorage.removeItem(`${this.prefix}dishes`);
    localStorage.removeItem(`${this.prefix}metrics`);
    localStorage.removeItem(`${this.prefix}cart`);
    this.initialized = false;
    this.init();
  }
}

// Instancia global accesible
window.db = new MelidanDB();
