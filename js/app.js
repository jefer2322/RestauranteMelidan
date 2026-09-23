/**
 * app.js - Controlador Principal de Melidan (SPA Mobile-First)
 * Conexión completa entre vistas, AuthService y PostgreSQL 18 (melidan_db).
 */

class AppController {
  constructor() {
    this.currentRecoveryEmail = '';
    this.currentRecoveryCode = '';
    this.cart = [
      { id: '1', name: 'Lechón a Fuego Lento', price: 48.00, qty: 1 },
      { id: '6', name: 'Limonada con Menta', price: 10.00, qty: 1 }
    ];
    this.activeKdsTab = 'cocinando';
    this.activeCategory = 'Todos';
    this.init();
  }

  async init() {
    this.bindEvents();
    this.initLiveClock();

    // Inicializar conexión con PostgreSQL
    await window.db.init();

    await this.renderStaffList();
    await this.renderAdminMetrics();
    await this.renderMenuDishes();
    this.updateCartBar();

    // Comprobar si ya existe una sesión activa
    const user = window.AuthService.getCurrentUser();
    if (user) {
      this.updateAdminHeader(user);
      if (user.role === 'ADMIN') {
        this.showScreen('admin');
      } else if (user.role === 'CHEF') {
        this.showScreen('kds');
      } else {
        this.showScreen('admin');
      }
    } else {
      this.showScreen('login');
    }
  }

  /**
   * Actualiza el avatar y nombre del usuario en la cabecera
   */
  updateAdminHeader(user) {
    if (!user) return;
    const nameEl = document.querySelector('.user-name');
    const avatarEl = document.getElementById('admin-user-avatar');
    if (nameEl) nameEl.textContent = user.name;
    if (avatarEl && user.avatar) avatarEl.src = user.avatar;
  }

  // ==========================================
  // NAVEGACIÓN ENTRE PANTALLAS
  // ==========================================

  showScreen(screenId) {
    document.querySelectorAll('.view-screen').forEach(s => s.classList.remove('active-screen'));
    const target = document.getElementById(`screen-${screenId}`);
    if (target) {
      target.classList.add('active-screen');
      window.scrollTo(0, 0);
    }

    // Controlar visibilidad de la barra inferior (oculta en login/recuperación)
    const bottomBar = document.getElementById('app-bottom-bar');
    const isAuth = screenId.startsWith('login') || screenId.startsWith('forgot');
    if (bottomBar) {
      bottomBar.style.display = isAuth ? 'none' : 'flex';
      // Actualizar botón activo de la barra inferior
      document.querySelectorAll('.bottom-bar-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.screen === screenId);
      });
    }

    // Refrescar vistas según la pantalla
    if (screenId === 'admin') this.renderAdminMetrics();
    if (screenId === 'staff') this.renderStaffList();
    if (screenId === 'menu') this.renderMenuDishes();
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
          this.updateAdminHeader(user);
          this.showToast(`¡Bienvenido ${user.name}!`);

          // Si es Admin, manda directamente al Panel de Administrador (Captura 4)
          if (user.role === 'ADMIN') {
            this.showScreen('admin');
          } else if (user.role === 'CHEF') {
            this.showScreen('kds');
          } else {
            this.showScreen('admin');
          }
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

          // Formatear en paso 2
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

    // 5. Registrar Nuevo Empleado en PostgreSQL (Captura 2)
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
  // PANEL DE ADMINISTRADOR (PostgreSQL - Captura 4)
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
    if (elTables) elTables.textContent = metrics.mesas_texto || '8 / 15';
    if (elTime) elTime.textContent = metrics.tiempo_promedio || '14 min';

    // Renderizar lista de comandas de monitoreo de salón desde PostgreSQL
    const containerOrders = document.getElementById('admin-orders-list');
    if (containerOrders && dashboardData.salon_monitor) {
      containerOrders.innerHTML = dashboardData.salon_monitor.map(ord => {
        const isReady = (ord.estado === 'listo');
        const badgeClass = isReady ? 'badge-status-ready' : 'badge-status-cooking';
        const numMesa = ord.numero_mesa ? String(ord.numero_mesa).padStart(2, '0') : '08';
        const numComanda = ord.numero_comanda || ord.id_pedido;
        const total = parseFloat(ord.total || 0).toFixed(2);

        return `
          <div class="order-monitoring-card">
            <div class="order-header-line">
              <span class="order-id-table">#${numComanda} • Mesa ${numMesa}</span>
              <span class="order-price">S/ ${total}</span>
            </div>
            <div class="order-footer-line">
              <span class="order-waiter-name">Mozo: ${ord.mozo_nombre || 'Carlos P.'}</span>
              <span class="${badgeClass}">${ord.badge_text || 'En cocina'}</span>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // ==========================================
  // GESTIÓN DE PERSONAL (PostgreSQL - Captura 2)
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
          <span class="action-text-teal" onclick="app.showToast('Editando perfil de ${s.name}')">Editar Perfil</span>
          <span class="action-text-muted" onclick="app.showToast('Horario: ${s.shift}')">Ver Horarios</span>
        </div>
      </div>
    `).join('');
  }

  // ==========================================
  // COCINA KDS (Captura 3)
  // ==========================================

  filterKds(tab) {
    this.activeKdsTab = tab;
    document.querySelectorAll('.kds-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    const card1045 = document.getElementById('kds-card-1045');
    const card1046 = document.getElementById('kds-card-1046');

    if (tab === 'cocinando') {
      if (card1045) card1045.style.display = 'block';
      if (card1046) card1046.style.display = 'block';
    } else if (tab === 'nuevos') {
      if (card1045) card1045.style.display = 'none';
      if (card1046) card1046.style.display = 'block';
    } else if (tab === 'listos') {
      if (card1045) card1045.style.display = 'block';
      if (card1046) card1046.style.display = 'none';
    }
  }

  async markKdsReady(orderId) {
    const card = document.getElementById(`kds-card-${orderId}`);
    if (card) {
      const btn = card.querySelector('button');
      if (btn) {
        btn.textContent = '✓ Plato Listo (Actualizando BD...)';
        btn.disabled = true;
      }
    }

    // Actualizar estado en PostgreSQL
    await window.db.updateOrderStatus(orderId, 'listo');

    if (card) {
      const btn = card.querySelector('button');
      if (btn) {
        btn.textContent = '✓ Plato Listo (Entregado al Mozo)';
        btn.style.opacity = '0.75';
      }
    }

    // Actualizar Stepper del Tracker
    const stepReady = document.getElementById('step-ready');
    if (stepReady) {
      stepReady.classList.remove('opacity-75');
      const marker = stepReady.querySelector('.step-marker');
      if (marker) {
        marker.textContent = '✓';
        marker.className = 'step-marker text-success';
      }
    }

    const badge = document.getElementById('tracker-status-badge');
    if (badge) {
      badge.textContent = '¡Listo para Servir!';
      badge.className = 'badge-status-ready';
    }

    this.showToast(`✅ Comanda #${orderId} actualizada a LISTA en PostgreSQL!`);
  }

  async markKdsCooking(orderId) {
    const card = document.getElementById(`kds-card-${orderId}`);
    if (card) {
      const btn = card.querySelector('button');
      if (btn) {
        btn.className = 'btn-kds-ready';
        btn.textContent = '¡Plato Listo!';
        btn.setAttribute('onclick', `app.markKdsReady('${orderId}')`);
      }
    }

    // Actualizar estado en PostgreSQL
    await window.db.updateOrderStatus(orderId, 'en_cocina');
    this.showToast(`🍳 Comanda #${orderId} puesta en preparación en PostgreSQL.`);
  }

  // ==========================================
  // CARTA DIGITAL QR & CARRITO (Captura 5)
  // ==========================================

  filterMenu(category) {
    this.activeCategory = category;
    document.querySelectorAll('.cat-pill').forEach(pill => {
      pill.classList.toggle('active', pill.dataset.cat === category);
    });
    this.renderMenuDishes();
  }

  async renderMenuDishes() {
    const container = document.getElementById('dishes-list-container');
    if (!container) return;

    let dishes = await window.db.getProducts();
    if (this.activeCategory !== 'Todos') {
      dishes = dishes.filter(d => (d.categoria_nombre || d.category) === this.activeCategory);
    }

    container.innerHTML = dishes.map(d => {
      const price = parseFloat(d.price).toFixed(2);
      const isPopular = d.destacado_menu || d.popular;
      return `
        <div class="dish-item-card">
          <div class="dish-image-wrapper">
            <img src="${d.image || d.imagen_url}" alt="${d.name}" class="dish-img" onerror="this.src='https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80'">
            ${isPopular ? '<span class="dish-badge-popular">★ Popular</span>' : ''}
          </div>
          <div class="dish-details">
            <h4 class="dish-name">${d.name}</h4>
            <p class="dish-desc">${d.description || ''}</p>
            <div class="dish-footer">
              <span class="dish-price">S/ ${price}</span>
              <button class="btn-dish-add" onclick="app.addToCart(${JSON.stringify(d.id)})">
                <i class="bi bi-plus-lg"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  async addToCart(dishId) {
    const dishes = await window.db.getProducts();
    const dish = dishes.find(d => String(d.id) === String(dishId));
    if (!dish) return;

    const existing = this.cart.find(item => String(item.id) === String(dishId));
    if (existing) {
      existing.qty++;
    } else {
      this.cart.push({
        id: dish.id,
        name: dish.name,
        price: parseFloat(dish.price),
        qty: 1
      });
    }

    this.updateCartBar();
    this.showToast(`¡Agregado: ${dish.name}!`);
  }

  updateCartBar() {
    const bar = document.getElementById('cart-floating-bar');
    if (!bar) return;

    const totalItems = this.cart.reduce((sum, item) => sum + item.qty, 0);
    const totalPrice = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

    const countEl = document.getElementById('cart-items-count');
    const totalEl = document.getElementById('cart-total-price');

    if (countEl) countEl.textContent = `${totalItems} items`;
    if (totalEl) totalEl.textContent = `S/ ${totalPrice.toFixed(2)}`;

    if (totalItems > 0) {
      bar.classList.remove('d-none');
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

      const kdsClock = document.getElementById('kds-live-clock');
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

  quickLogin(email, password) {
    const elEmail = document.getElementById('login-email');
    const elPass = document.getElementById('login-password');
    if (elEmail) elEmail.value = email;
    if (elPass) elPass.value = password;
    this.showToast(`Credenciales cargadas: ${email}`);
    document.getElementById('form-login').dispatchEvent(new Event('submit'));
  }
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  window.app = new AppController();
});
