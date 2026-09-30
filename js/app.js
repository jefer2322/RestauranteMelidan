/**
 * app.js - Controlador Principal de Melidan (SPA Mobile-First)
 * Conexión completa entre vistas, AuthService y PostgreSQL 18 (Melidan_db).
 */

// Configuración de Permisos por Rol (RBAC)
const ROLE_PERMISSIONS = {
  ADMIN: {
    label: 'Administrador',
    badgeClass: 'bg-primary-subtle text-primary border-primary-subtle',
    icon: '👑',
    allowedScreens: ['admin', 'staff', 'kds', 'menu', 'tracker'],
    defaultScreen: 'admin',
    description: 'Acceso total al sistema de gestión y monitoreo'
  },
  CHEF: {
    label: 'Cocinero / Chef',
    badgeClass: 'bg-warning text-dark',
    icon: '👨‍🍳',
    allowedScreens: ['kds'],
    defaultScreen: 'kds',
    description: 'Acceso exclusivo al Sistema de Cocina (KDS)'
  },
  WAITER: {
    label: 'Mozo / Salón',
    badgeClass: 'bg-success-subtle text-success border-success-subtle',
    icon: '🛎️',
    allowedScreens: ['menu', 'tracker'],
    defaultScreen: 'menu',
    description: 'Acceso exclusivo a Carta QR y Monitoreo de Mesas'
  },
  CASHIER: {
    label: 'Cajero / Facturación',
    badgeClass: 'bg-info-subtle text-info border-info-subtle',
    icon: '💵',
    allowedScreens: ['tracker', 'menu'],
    defaultScreen: 'tracker',
    description: 'Acceso a Facturación / Comprobantes y Carta'
  }
};

class AppController {
  constructor() {
    this.currentRecoveryEmail = '';
    this.currentRecoveryCode = '';
    this.cart = [
      { id: 1, id_producto: 1, name: 'Lechón a Fuego Lento', price: 48.00, precio: 48.00, qty: 1, cantidad: 1 },
      { id: 5, id_producto: 5, name: 'Chicha Morada Artesanal (1L)', price: 14.00, precio: 14.00, qty: 1, cantidad: 1 }
    ];
    this.activeKdsTab = 'cocinando';
    this.activeCategory = 'Todos';
    this.searchTerm = '';
    this.init();
  }

  // ==========================================
  // SEGURIDAD Y CONTROL DE ROLES (RBAC)
  // ==========================================

  normalizeRole(role) {
    if (!role) return 'WAITER';
    const r = String(role).trim().toUpperCase();
    if (r === 'ADMIN' || r === 'ADMINISTRADOR') return 'ADMIN';
    if (r === 'CHEF' || r === 'COCINA' || r === 'COCINERO') return 'CHEF';
    if (r === 'WAITER' || r === 'MOZO' || r === 'MESERO') return 'WAITER';
    if (r === 'CASHIER' || r === 'CAJERO' || r === 'CAJA') return 'CASHIER';
    return 'WAITER';
  }

  getRoleConfig(role) {
    const norm = this.normalizeRole(role);
    return ROLE_PERMISSIONS[norm] || ROLE_PERMISSIONS.WAITER;
  }

  /**
   * Aplica los permisos de acceso al menú inferior:
   * Solo muestra las pestañas permitidas para el rol activo.
   */
  applyRolePermissions(user) {
    const bottomBar = document.getElementById('app-bottom-bar');
    if (!bottomBar) return;

    if (!user) {
      bottomBar.style.display = 'none';
      return;
    }

    const roleConfig = this.getRoleConfig(user.role);
    const buttons = bottomBar.querySelectorAll('.bottom-bar-btn[data-screen]');

    buttons.forEach(btn => {
      const screen = btn.dataset.screen;
      const isAllowed = roleConfig.allowedScreens.includes(screen);
      btn.classList.toggle('d-none', !isAllowed);
    });
  }

  /**
   * Actualiza el avatar, nombre e insignias del usuario en todas las cabeceras
   */
  updateUserHeaders(user) {
    if (!user) return;
    const roleConfig = this.getRoleConfig(user.role);

    // 1. Header Admin
    const nameEl = document.getElementById('admin-user-name') || document.querySelector('.user-name');
    const avatarEl = document.getElementById('admin-user-avatar');
    const adminRoleBadge = document.getElementById('admin-role-badge');
    if (nameEl) nameEl.textContent = user.name;
    if (avatarEl && user.avatar) avatarEl.src = user.avatar;
    if (adminRoleBadge) {
      adminRoleBadge.textContent = `${roleConfig.icon} ${roleConfig.label}`;
      adminRoleBadge.className = `badge ${roleConfig.badgeClass} border`;
    }

    // 2. Header Staff
    const staffUserName = document.getElementById('staff-header-user-name');
    const staffUserAvatar = document.getElementById('staff-user-avatar');
    if (staffUserName) staffUserName.textContent = user.name;
    if (staffUserAvatar && user.avatar) staffUserAvatar.src = user.avatar;

    // 3. Header KDS (Cocina)
    const kdsBadge = document.getElementById('kds-user-badge');
    if (kdsBadge) {
      kdsBadge.textContent = `${roleConfig.icon} ${user.name}`;
    }

    // 4. Header Menú (Carta QR)
    const menuBadge = document.getElementById('menu-user-badge');
    if (menuBadge) {
      menuBadge.textContent = `${roleConfig.icon} ${user.name}`;
    }

    // 5. Header Tracker
    const trackerBadge = document.getElementById('tracker-user-badge');
    if (trackerBadge) {
      trackerBadge.textContent = `${roleConfig.icon} ${user.name} (${roleConfig.label})`;
    }
  }

  async init() {
    this.bindEvents();
    this.initLiveClock();

    // Inicializar conexión con PostgreSQL
    await window.db.init();

    await this.renderStaffList();
    await this.renderAdminMetrics();
    await this.renderMenuDishes();
    await this.renderKdsOrders();
    await this.renderTrackerOrder();
    this.updateCartBar();

    // Comprobar si ya existe una sesión activa y redirigir a su apartado
    const user = window.AuthService.getCurrentUser();
    if (user) {
      this.applyRolePermissions(user);
      this.updateUserHeaders(user);
      const roleConfig = this.getRoleConfig(user.role);
      this.showScreen(roleConfig.defaultScreen);
    } else {
      this.showScreen('login');
    }
  }

  // ==========================================
  // NAVEGACIÓN ENTRE PANTALLAS
  // ==========================================

  showScreen(screenId) {
    const isAuth = screenId.startsWith('login') || screenId.startsWith('forgot');
    const user = window.AuthService.getCurrentUser();

    // 1. Guardia de sesión: Si no es pantalla de autenticación y no hay usuario, redirigir a login
    if (!isAuth && !user) {
      this.showScreen('login');
      return;
    }

    // 2. Guardia de control de acceso por rol (RBAC)
    if (!isAuth && user) {
      const roleConfig = this.getRoleConfig(user.role);
      if (!roleConfig.allowedScreens.includes(screenId)) {
        this.showToast(`🚫 Acceso restringido: Como ${roleConfig.label}, tu usuario únicamente tiene acceso a su apartado.`);
        this.showScreen(roleConfig.defaultScreen);
        return;
      }
    }

    // Ocultar todas las pantallas y mostrar la pantalla destino
    document.querySelectorAll('.view-screen').forEach(s => s.classList.remove('active-screen'));
    const target = document.getElementById(`screen-${screenId}`);
    if (target) {
      target.classList.add('active-screen');
      window.scrollTo(0, 0);
    }

    // Controlar visibilidad de la barra inferior y filtrar pestañas por rol
    const bottomBar = document.getElementById('app-bottom-bar');
    if (bottomBar) {
      bottomBar.style.display = isAuth ? 'none' : 'flex';
      this.applyRolePermissions(user);
      // Actualizar botón activo de la barra inferior
      document.querySelectorAll('.bottom-bar-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.screen === screenId);
      });
    }

    // Refrescar vistas según la pantalla
    if (screenId === 'admin') this.renderAdminMetrics();
    if (screenId === 'staff') this.renderStaffList();
    if (screenId === 'kds') this.renderKdsOrders();
    if (screenId === 'menu') this.renderMenuDishes();
    if (screenId === 'tracker') this.renderTrackerOrder();
  }

  // ==========================================
  // AUTENTICACIÓN Y RECUPERACIÓN (POSTGRESQL)
  // ==========================================

  bindEvents() {
    // 1. Login (PostgreSQL)
    const formLogin = document.getElementById('form-login');
    if (formLogin) {
      formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const alertBox = document.getElementById('login-alert');
        const submitBtn = document.getElementById('btn-login-submit');

        alertBox.classList.add('d-none');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Verificando en PostgreSQL...';

        try {
          const user = await window.AuthService.login(email, password);
          this.applyRolePermissions(user);
          this.updateUserHeaders(user);
          const roleConfig = this.getRoleConfig(user.role);
          this.showToast(`¡Bienvenido ${user.name}! (${roleConfig.label})`);
          this.showScreen(roleConfig.defaultScreen);
        } catch (err) {
          alertBox.textContent = err.message;
          alertBox.classList.remove('d-none');
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Iniciar Sesión';
        }
      });
    }

    // 2. Recuperación Paso 1: Enviar código de 6 dígitos
    const formForgot1 = document.getElementById('form-forgot-step1');
    if (formForgot1) {
      formForgot1.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('forgot-email').value;
        const alertBox = document.getElementById('forgot1-alert');
        alertBox.classList.add('d-none');

        try {
          const res = await window.AuthService.sendOtpCode(email);
          this.currentRecoveryEmail = email;
          this.showToast(`Código generado: ${res.code}`);

          const otpInput = document.getElementById('otp-code');
          if (otpInput) {
            otpInput.value = res.code.substring(0, 3) + '-' + res.code.substring(3, 6);
          }
          this.showScreen('forgot-step2');
        } catch (err) {
          alertBox.textContent = err.message;
          alertBox.classList.remove('d-none');
        }
      });
    }

    // 3. Recuperación Paso 2: Verificar código
    const formForgot2 = document.getElementById('form-forgot-step2');
    if (formForgot2) {
      formForgot2.addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = document.getElementById('otp-code').value.replace(/[^0-9]/g, '');
        const alertBox = document.getElementById('forgot2-alert');
        alertBox.classList.add('d-none');

        try {
          await window.AuthService.verifyOtp(this.currentRecoveryEmail, code);
          this.currentRecoveryCode = code;
          this.showToast('Código verificado con éxito');
          this.showScreen('forgot-step3');
        } catch (err) {
          alertBox.textContent = err.message;
          alertBox.classList.remove('d-none');
        }
      });
    }

    // 4. Recuperación Paso 3: Cambiar contraseña
    const formForgot3 = document.getElementById('form-forgot-step3');
    if (formForgot3) {
      formForgot3.addEventListener('submit', async (e) => {
        e.preventDefault();
        const p1 = document.getElementById('new-password').value;
        const p2 = document.getElementById('confirm-password').value;
        const alertBox = document.getElementById('forgot3-alert');
        alertBox.classList.add('d-none');

        try {
          await window.AuthService.resetPassword(this.currentRecoveryEmail, this.currentRecoveryCode, p1, p2);
          this.showToast('¡Contraseña actualizada en PostgreSQL con éxito!');
          document.getElementById('login-email').value = this.currentRecoveryEmail;
          document.getElementById('login-password').value = p1;
          this.showScreen('login');
        } catch (err) {
          alertBox.textContent = err.message;
          alertBox.classList.remove('d-none');
        }
      });
    }

    // 5. Registrar Nuevo Empleado en PostgreSQL
    const formStaff = document.getElementById('form-new-staff');
    if (formStaff) {
      formStaff.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('staff-name-input');
        const roleSelect = document.getElementById('staff-role-select');
        const name = nameInput.value.trim();
        const role = roleSelect.value;
        const submitBtn = formStaff.querySelector('button[type="submit"]');

        if (!name) return;

        submitBtn.disabled = true;
        submitBtn.textContent = 'Guardando en PostgreSQL...';

        try {
          const newStaff = {
            name: name,
            role: role,
            shift: 'Turno Mañana (8:00 AM - 4:00 PM)',
            status: 'Activo'
          };

          await window.db.insertStaff(newStaff);
          await this.renderStaffList();
          nameInput.value = '';
          this.showToast(`¡Empleado ${name} guardado en PostgreSQL!`);
        } catch (err) {
          this.showToast(`Error: ${err.message}`);
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Guardar Usuario';
        }
      });
    }
  }

  // ==========================================
  // PANEL DE ADMINISTRADOR (PostgreSQL)
  // ==========================================

  async renderAdminMetrics() {
    const dashboardData = await window.db.getDashboard();
    const metrics = dashboardData.metrics;

    const elSales = document.getElementById('metric-sales');
    const elOrders = document.getElementById('metric-active-orders');
    const elTables = document.getElementById('metric-tables');
    const elTime = document.getElementById('metric-avg-time');

    if (elSales) elSales.textContent = metrics.ventas_hoy_formato || `S/ ${parseFloat(metrics.ventas_hoy).toFixed(2)}`;
    if (elOrders) elOrders.textContent = metrics.pedidos_activos;
    if (elTables) elTables.textContent = metrics.mesas_texto || '2 / 5';
    if (elTime) elTime.textContent = metrics.tiempo_promedio || '14 min';

    // Renderizar lista de comandas de monitoreo de salón desde PostgreSQL
    const containerOrders = document.getElementById('admin-orders-list');
    if (containerOrders && dashboardData.salon_monitor) {
      containerOrders.innerHTML = dashboardData.salon_monitor.map(ord => {
        const isReady = (ord.estado === 'listo');
        const badgeClass = isReady ? 'badge-status-ready' : 'badge-status-cooking';
        const numMesa = ord.numero_mesa ? String(ord.numero_mesa).padStart(2, '0') : '02';
        const numComanda = ord.numero_comanda || ord.id_pedido;
        const total = parseFloat(ord.total || 0).toFixed(2);

        return `
          <div class="order-monitoring-card">
            <div class="order-header-line">
              <span class="order-id-table">#${numComanda} • Mesa ${numMesa}</span>
              <span class="order-price">S/ ${total}</span>
            </div>
            <div class="order-footer-line">
              <span class="order-waiter-name">Mozo: ${ord.mozo_nombre || 'Carlos Paredes'}</span>
              <span class="${badgeClass}">${ord.badge_text || 'En cocina'}</span>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // ==========================================
  // GESTIÓN DE PERSONAL (PostgreSQL)
  // ==========================================

  async renderStaffList() {
    const container = document.getElementById('staff-cards-container');
    if (!container) return;

    const staff = await window.db.getStaff();
    container.innerHTML = staff.map(s => `
      <div class="staff-card">
        <div class="staff-header-line">
          <span class="staff-name-text">${s.name}</span>
          <span class="${s.status === 'Activo' ? 'badge-staff-active' : 'badge-staff-inactive'}">
            ${s.status}
          </span>
        </div>
        <div class="staff-meta-text">${s.email} • <strong>${s.role}</strong></div>
        <div class="staff-meta-text">${s.shift}</div>
        <div class="staff-actions-line">
          <span class="action-text-teal" onclick="app.toggleStaffStatus(${s.id}, '${s.status}')">
            ${s.status === 'Activo' ? 'Desactivar Cuenta' : 'Activar Cuenta'}
          </span>
          <span class="action-text-muted" onclick="app.showToast('Horario asignado: ${s.shift}')">Ver Horarios</span>
        </div>
      </div>
    `).join('');
  }

  // ==========================================
  // COCINA KDS (PostgreSQL)
  // ==========================================

  async filterKds(tab) {
    this.activeKdsTab = tab;
    document.querySelectorAll('.kds-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    await this.renderKdsOrders();
  }

  async renderKdsOrders() {
    const container = document.getElementById('kds-orders-container');
    if (!container) return;

    const orders = await window.db.getOrders();

    // Contar órdenes por estado
    const countNuevos = orders.filter(o => o.estado === 'pendiente').length;
    const countCocinando = orders.filter(o => o.estado === 'en_cocina').length;
    const countListos = orders.filter(o => o.estado === 'listo').length;

    const badgeNuevos = document.getElementById('kds-count-nuevos');
    const badgeCocinando = document.getElementById('kds-count-cocinando');
    const badgeListos = document.getElementById('kds-count-listos');
    if (badgeNuevos) badgeNuevos.textContent = countNuevos;
    if (badgeCocinando) badgeCocinando.textContent = countCocinando;
    if (badgeListos) badgeListos.textContent = countListos;

    // Filtrar según pestaña activa
    let filtered = [];
    if (this.activeKdsTab === 'nuevos') {
      filtered = orders.filter(o => o.estado === 'pendiente');
    } else if (this.activeKdsTab === 'cocinando') {
      filtered = orders.filter(o => o.estado === 'en_cocina');
    } else if (this.activeKdsTab === 'listos') {
      filtered = orders.filter(o => o.estado === 'listo');
    } else {
      filtered = orders.filter(o => ['pendiente', 'en_cocina', 'listo'].includes(o.estado));
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="text-center py-5 text-secondary">
          <i class="bi bi-check2-circle fs-1 text-teal d-block mb-2"></i>
          <div class="fw-bold">No hay comandas en este estado</div>
          <small>Los nuevos pedidos ingresarán automáticamente</small>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(order => {
      const tableNum = String(order.numero_mesa || 1).padStart(2, '0');
      const comandaNum = order.numero_comanda || order.id_pedido;
      const timeFormatted = order.hora_formato || '10:45';
      const client = order.nombre_cliente || 'Comensal';

      const items = order.items || [];
      const itemsHtml = items.map((item, idx) => `
        <div class="kds-dish-line ${idx === items.length - 1 ? 'mb-3' : ''}">
          <span class="kds-dish-qty">${item.cantidad}x</span>
          <span class="text-white">${item.nombre_plato || 'Plato'}</span>
          ${item.observaciones ? `<div class="kds-dish-note">* ${item.observaciones}</div>` : ''}
        </div>
      `).join('');

      let actionBtn = '';
      if (order.estado === 'pendiente') {
        actionBtn = `<button type="button" class="btn-kds-prepare" onclick="app.markKdsCooking(${order.id_pedido})">Preparar Pedido</button>`;
      } else if (order.estado === 'en_cocina') {
        actionBtn = `<button type="button" class="btn-kds-ready" onclick="app.markKdsReady(${order.id_pedido})">¡Plato Listo!</button>`;
      } else if (order.estado === 'listo') {
        actionBtn = `<button type="button" class="btn-kds-ready" style="opacity: 0.8" onclick="app.markKdsDelivered(${order.id_pedido})">✓ Entregar a Mozo</button>`;
      }

      return `
        <div class="kds-order-card" id="kds-card-${order.id_pedido}">
          <div class="kds-card-header">
            <div>
              <div class="kds-table-title">Mesa ${tableNum}</div>
              <small class="text-secondary">#${comandaNum} • Cliente: ${client}</small>
            </div>
            <span class="kds-card-time">${timeFormatted}</span>
          </div>
          ${itemsHtml}
          ${actionBtn}
        </div>
      `;
    }).join('');
  }

  async markKdsReady(orderId) {
    await window.db.updateOrderStatus(orderId, 'listo');
    this.showToast(`✅ Comanda #${orderId} actualizada a LISTA en PostgreSQL!`);
    await this.renderKdsOrders();
    await this.renderAdminMetrics();
    await this.renderTrackerOrder();
  }

  async markKdsCooking(orderId) {
    await window.db.updateOrderStatus(orderId, 'en_cocina');
    this.showToast(`🍳 Comanda #${orderId} puesta en preparación en PostgreSQL.`);
    await this.renderKdsOrders();
    await this.renderAdminMetrics();
    await this.renderTrackerOrder();
  }

  async markKdsDelivered(orderId) {
    await window.db.updateOrderStatus(orderId, 'entregado');
    this.showToast(`✨ Comanda #${orderId} entregada en mesa.`);
    await this.renderKdsOrders();
    await this.renderAdminMetrics();
    await this.renderTrackerOrder();
  }

  // ==========================================
  // CARTA DIGITAL QR & CARRITO (PostgreSQL)
  // ==========================================

  filterCategory(category, btn) {
    this.activeCategory = category;
    document.querySelectorAll('.category-pill').forEach(pill => pill.classList.remove('active'));
    if (btn) btn.classList.add('active');
    this.renderMenuDishes();
  }

  searchMenu(term) {
    this.searchTerm = (term || '').trim().toLowerCase();
    this.renderMenuDishes();
  }

  async renderMenuDishes() {
    const container = document.getElementById('menu-dishes-container') || document.getElementById('dishes-list-container');
    if (!container) return;

    let dishes = await window.db.getProducts();

    if (this.activeCategory !== 'Todos') {
      dishes = dishes.filter(d => (d.categoria_nombre || d.category) === this.activeCategory);
    }

    if (this.searchTerm) {
      dishes = dishes.filter(d => 
        (d.name || '').toLowerCase().includes(this.searchTerm) || 
        (d.description || '').toLowerCase().includes(this.searchTerm)
      );
    }

    if (dishes.length === 0) {
      container.innerHTML = `
        <div class="text-center py-5 text-secondary">
          <i class="bi bi-search fs-2 mb-2 d-block"></i>
          <div class="fw-bold">No se encontraron platos</div>
          <small>Intenta con otra categoría o término de búsqueda</small>
        </div>
      `;
      return;
    }

    container.innerHTML = dishes.map(d => {
      const price = parseFloat(d.price).toFixed(2);
      const isPopular = d.destacado_menu || d.popular;
      const imgUrl = d.image || d.imagen_url || 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80';

      return `
        <div class="dish-item-card">
          <img src="${imgUrl}" alt="${d.name}" class="dish-img-thumb" onerror="this.src='https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80'">
          <div class="flex-grow-1">
            <div class="d-flex align-items-center justify-content-between">
              <h4 class="dish-name-title mb-1">${d.name}</h4>
              ${isPopular ? '<span class="badge bg-warning text-dark small fw-bold px-2 py-0" style="font-size: 0.72rem; border-radius: 6px;">★ Popular</span>' : ''}
            </div>
            <p class="dish-desc-text">${d.description || ''}</p>
            <div class="d-flex justify-content-between align-items-center">
              <span class="dish-price-text">S/ ${price}</span>
              <button type="button" class="btn-add-dish" onclick="app.addToCart(${d.id})" title="Agregar al pedido">
                <i class="bi bi-plus"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  async addToCart(dishId) {
    const dishes = await window.db.getProducts();
    const dish = dishes.find(d => Number(d.id) === Number(dishId));
    if (!dish) return;

    const existing = this.cart.find(item => Number(item.id) === Number(dishId));
    if (existing) {
      existing.qty++;
      existing.cantidad = existing.qty;
    } else {
      this.cart.push({
        id: dish.id,
        id_producto: dish.id,
        name: dish.name,
        price: parseFloat(dish.price),
        precio: parseFloat(dish.price),
        qty: 1,
        cantidad: 1
      });
    }

    this.updateCartBar();
    this.showToast(`¡Agregado: ${dish.name}!`);
  }

  updateCartBar() {
    const bar = document.getElementById('cart-floating-bar');
    if (!bar) return;

    const totalItems = this.cart.reduce((sum, item) => sum + (item.qty || item.cantidad || 1), 0);
    const totalPrice = this.cart.reduce((sum, item) => sum + ((item.price || item.precio || 0) * (item.qty || item.cantidad || 1)), 0);

    const countEl = document.getElementById('cart-item-count') || document.getElementById('cart-items-count');
    const totalEl = document.getElementById('cart-total-amount') || document.getElementById('cart-total-price');

    if (countEl) countEl.textContent = `${totalItems} ${totalItems === 1 ? 'item' : 'items'}`;
    if (totalEl) totalEl.textContent = `S/ ${totalPrice.toFixed(2)}`;

    bar.style.display = totalItems > 0 ? 'flex' : 'none';
  }

  async checkoutCart() {
    if (this.cart.length === 0) {
      this.showToast('El carrito está vacío. Agrega platos primero.');
      return;
    }

    try {
      this.showToast('Enviando comanda a la cocina (PostgreSQL)...');
      const currentUser = window.AuthService.getCurrentUser();
      const waiterName = currentUser?.name || 'Carlos Paredes';
      const result = await window.db.createOrder({
        table_num: 4,
        client_name: 'Cliente Mesa 04',
        waiter_name: waiterName,
        items: this.cart
      });

      this.showToast(`✅ Comanda #${result.numero_comanda} creada exitosamente en PostgreSQL!`);
      this.cart = [];
      this.updateCartBar();
      await this.renderKdsOrders();
      await this.renderAdminMetrics();
      await this.renderTrackerOrder();
      this.showScreen('tracker');
    } catch (err) {
      this.showToast(`Error al procesar comanda: ${err.message}`);
    }
  }

  // ==========================================
  // TRACKER DE PEDIDO EN VIVO (PostgreSQL)
  // ==========================================

  async renderTrackerOrder() {
    const orders = await window.db.getOrders();
    if (orders.length === 0) return;

    const activeOrder = orders[0]; // La comanda más reciente
    const comandaNum = activeOrder.numero_comanda || activeOrder.id_pedido;
    const numMesa = activeOrder.numero_mesa ? String(activeOrder.numero_mesa).padStart(2, '0') : '04';

    const orderNumEl = document.getElementById('tracker-order-num');
    if (orderNumEl) orderNumEl.textContent = `Pedido • #${comandaNum}`;

    const tableBadge = document.querySelector('#screen-tracker .table-pill-badge');
    if (tableBadge) tableBadge.textContent = `Mesa #${numMesa}`;

    // Actualizar badge de estado
    const badge = document.getElementById('tracker-status-badge');
    if (badge) {
      if (activeOrder.estado === 'pendiente') {
        badge.textContent = 'Pendiente en Cocina';
        badge.className = 'badge-status-cooking';
        badge.style.backgroundColor = '#64748B';
      } else if (activeOrder.estado === 'en_cocina') {
        badge.textContent = 'En cocina';
        badge.className = 'badge-status-cooking';
        badge.style.backgroundColor = '#FF5722';
      } else if (activeOrder.estado === 'listo') {
        badge.textContent = '¡Listo para Servir!';
        badge.className = 'badge-status-ready';
        badge.style.backgroundColor = '#009B77';
      } else if (activeOrder.estado === 'entregado') {
        badge.textContent = 'Entregado en Mesa';
        badge.className = 'badge-status-ready';
        badge.style.backgroundColor = '#009B77';
      }
    }

    // Actualizar Stepper según el estado
    const stepReady = document.getElementById('step-ready');
    const stepDelivered = document.getElementById('step-delivered');

    if (activeOrder.estado === 'listo') {
      if (stepReady) {
        stepReady.classList.remove('opacity-75');
        const m = stepReady.querySelector('.step-marker');
        if (m) { m.textContent = '✓'; m.className = 'step-marker text-success'; }
      }
    } else if (activeOrder.estado === 'entregado') {
      if (stepReady) {
        stepReady.classList.remove('opacity-75');
        const m = stepReady.querySelector('.step-marker');
        if (m) { m.textContent = '✓'; m.className = 'step-marker text-success'; }
      }
      if (stepDelivered) {
        stepDelivered.classList.remove('opacity-50');
        const m = stepDelivered.querySelector('.step-marker');
        if (m) { m.textContent = '✓'; m.className = 'step-marker text-success'; }
      }
    }

    // Actualizar lista de platos en el tracker
    const dishesBox = document.getElementById('tracker-dishes-box');
    if (dishesBox && activeOrder.items && activeOrder.items.length > 0) {
      dishesBox.innerHTML = `
        <div class="fw-bold fs-6 text-dark mb-2">Platos en este pedido:</div>
        ${activeOrder.items.map(item => `
          <div class="text-secondary small mb-1">• ${item.cantidad}x ${item.nombre_plato} ${item.observaciones ? `(*${item.observaciones})` : ''}</div>
        `).join('')}
      `;
    }
  }

  // ==========================================
  // UTILIDADES: RELOJ Y NOTIFICACIONES
  // ==========================================

  initLiveClock() {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      const str = `${hours}:${minutes} ${ampm}`;

      const kdsClock = document.getElementById('kds-clock') || document.getElementById('kds-live-clock');
      if (kdsClock) kdsClock.textContent = str;
    };
    updateTime();
    setInterval(updateTime, 30000);
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-alert';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('hide');
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  async toggleStaffStatus(id, currentStatus) {
    const newStatus = (currentStatus === 'Activo') ? 'Inactivo' : 'Activo';
    try {
      this.showToast('Actualizando empleado en PostgreSQL...');
      const res = await fetch(`api/staff.php?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast(`Estado de ${data.member.nombre} cambiado a ${newStatus} en PostgreSQL`);
        await this.renderStaffList();
      } else {
        throw new Error(data.message);
      }
    } catch (e) {
      this.showToast('Error al actualizar empleado en PostgreSQL');
    }
  }

  async showElectronicReceipt() {
    this.showToast('Consultando comprobante en PostgreSQL (Melidan_db)...');
    const receipt = await window.db.getReceipt();
    if (!receipt) {
      this.showToast('No se encontró comprobante registrado en PostgreSQL aún.');
      return;
    }

    const modalHtml = `
      <div class="modal fade show" id="receiptModal" tabindex="-1" style="display: block; background: rgba(0,0,0,0.6); z-index: 10500;" aria-modal="true" role="dialog">
        <div class="modal-dialog modal-dialog-centered" style="max-width: 400px; margin: 1.5rem auto;">
          <div class="modal-content border-0 rounded-4 shadow-lg p-3" style="font-family: inherit;">
            <div class="modal-header border-0 pb-0 position-relative">
              <div class="text-center w-100">
                <h4 class="fw-bold mb-1 text-dark">${receipt.restaurante?.nombre || 'Melidan Restaurante'}</h4>
                <p class="text-secondary small mb-1">${receipt.restaurante?.slogan || 'Tradición y sabor a fuego lento'}</p>
                <div class="badge bg-dark px-3 py-1 mb-2">RUC: ${receipt.restaurante?.ruc || '20601234567'}</div>
                <div class="text-muted small">${receipt.restaurante?.direccion || ''}</div>
              </div>
              <button type="button" class="btn-close position-absolute top-0 end-0 m-3" onclick="document.getElementById('receiptModal').remove()"></button>
            </div>
            <div class="modal-body border-top border-bottom my-3 py-3">
              <div class="d-flex justify-content-between mb-1 small">
                <span class="text-muted">Comprobante:</span>
                <span class="fw-bold text-dark">${(receipt.tipo_comprobante || 'BOLETA').toUpperCase()}: ${receipt.numero_comprobante}</span>
              </div>
              <div class="d-flex justify-content-between mb-1 small">
                <span class="text-muted">Fecha Emisión:</span>
                <span class="text-dark">${receipt.fecha_formato || 'Hoy'}</span>
              </div>
              <div class="d-flex justify-content-between mb-1 small">
                <span class="text-muted">Mesa:</span>
                <span class="fw-bold text-dark">Mesa ${String(receipt.numero_mesa || '04').padStart(2, '0')}</span>
              </div>
              <div class="d-flex justify-content-between mb-3 small">
                <span class="text-muted">Cliente:</span>
                <span class="text-dark">${receipt.nombre_cliente || 'Comensal'}</span>
              </div>

              <div class="fw-bold small mb-2 text-dark border-top pt-2">Detalle de Consumo:</div>
              ${receipt.items?.map(it => `
                <div class="d-flex justify-content-between small mb-1">
                  <span>${it.cantidad}x ${it.nombre_plato}</span>
                  <span class="fw-bold">S/ ${parseFloat(it.subtotal || (it.cantidad * it.precio_unitario)).toFixed(2)}</span>
                </div>
              `).join('')}

              <div class="border-top pt-2 mt-2">
                <div class="d-flex justify-content-between small text-muted">
                  <span>Op. Gravada:</span>
                  <span>S/ ${receipt.desglose?.subtotal || '0.00'}</span>
                </div>
                <div class="d-flex justify-content-between small text-muted">
                  <span>I.G.V. (18%):</span>
                  <span>S/ ${receipt.desglose?.igv || '0.00'}</span>
                </div>
                <div class="d-flex justify-content-between fs-5 fw-bold text-dark mt-1">
                  <span>TOTAL:</span>
                  <span class="text-success">S/ ${receipt.desglose?.total || receipt.monto_total}</span>
                </div>
                <div class="small text-muted text-center mt-2">
                  <span class="badge bg-success-subtle text-success">Pago ${receipt.metodo_pago?.replace('_', ' ').toUpperCase()} • Exitoso</span>
                </div>
              </div>
            </div>
            <div class="modal-footer border-0 pt-0 d-flex gap-2">
              <button type="button" class="btn btn-outline-secondary rounded-3 w-100 fw-bold" onclick="document.getElementById('receiptModal').remove()">Cerrar</button>
              <button type="button" class="btn btn-dark rounded-3 w-100 fw-bold" onclick="window.print()">Imprimir PDF</button>
            </div>
          </div>
        </div>
      </div>
    `;
    const existing = document.getElementById('receiptModal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  async callWaiter() {
    const orders = await window.db.getOrders();
    const activeOrder = orders[0];
    const waiter = activeOrder?.mozo_nombre || 'Carlos Paredes';
    const table = activeOrder?.numero_mesa || 4;
    this.showToast(`🛎️ Mozo ${waiter} notificado a la Mesa 0${table}. ¡Viene en camino!`);
  }

  logout() {
    window.AuthService.logout();
    this.currentRecoveryEmail = '';
    this.currentRecoveryCode = '';

    const passwordInput = document.getElementById('login-password');
    if (passwordInput) {
      passwordInput.value = '';
    }

    const bottomBar = document.getElementById('app-bottom-bar');
    if (bottomBar) bottomBar.style.display = 'none';

    this.showScreen('login');
    this.showToast('Sesión cerrada correctamente.');
  }

  async quickLogin(email, password = 'password123') {
    const elEmail = document.getElementById('login-email');
    const elPass = document.getElementById('login-password');
    if (elEmail) elEmail.value = email;
    if (elPass) elPass.value = password;
    this.showToast(`Iniciando sesión como ${email}...`);

    try {
      const user = await window.AuthService.login(email, password);
      this.applyRolePermissions(user);
      this.updateUserHeaders(user);
      const roleConfig = this.getRoleConfig(user.role);
      this.showToast(`¡Bienvenido ${user.name}! [${roleConfig.label}]`);
      this.showScreen(roleConfig.defaultScreen);
    } catch (err) {
      this.showToast(`Error al autenticar: ${err.message}`);
    }
  }
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  window.app = new AppController();
});
