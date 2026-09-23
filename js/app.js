/**
 * app.js - Controlador Principal de Melidan (SPA Mobile-First)
 * Conexión completa entre vistas, AuthService y MelidanDB.
 */

class AppController {
  constructor() {
    this.currentRecoveryEmail = '';
    this.currentRecoveryCode = '';
    this.cart = [
      { id: 'dish_05', name: 'Arroz con Pato', price: 36.00, qty: 1 },
      { id: 'dish_04', name: 'Causa Limeña', price: 16.00, qty: 1 }
    ];
    this.activeKdsTab = 'cocinando';
    this.activeCategory = 'Todos';
    this.init();
  }

  async init() {
    this.bindEvents();
    this.renderStaffList();
    this.renderMenuDishes();
    this.updateCartBar();
    this.initLiveClock();

    // Comprobar si ya existe una sesión activa
    const user = window.AuthService.getCurrentUser();
    if (user) {
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
  // AUTENTICACIÓN Y RECUPERACIÓN
  // ==========================================

  bindEvents() {
    // 1. Login
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
        submitBtn.textContent = 'Verificando...';

        try {
          const user = await window.AuthService.login(email, password);
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
          this.showToast('¡Contraseña cambiada con éxito!');
          document.getElementById('login-email').value = this.currentRecoveryEmail;
          document.getElementById('login-password').value = p1;
          this.showScreen('login');
        } catch (err) {
          alertBox.textContent = err.message;
          alertBox.classList.remove('d-none');
        }
      });
    }

    // 5. Registrar Nuevo Empleado (Captura 2)
    const formStaff = document.getElementById('form-new-staff');
    if (formStaff) {
      formStaff.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('staff-name-input');
        const roleSelect = document.getElementById('staff-role-select');
        const name = nameInput.value.trim();
        const role = roleSelect.value;

        if (!name) return;

        const newStaff = {
          id: `stf_${Date.now()}`,
          name: name,
          email: `${name.toLowerCase().replace(/\s+/g, '.')}@melidan.com`,
          role: role,
          shift: 'Turno Mañana (8:00 AM - 4:00 PM)',
          status: 'Activo'
        };

        await window.db.insert('staff', newStaff);
        this.renderStaffList();
        nameInput.value = '';
        this.showToast(`¡Empleado ${name} registrado con éxito!`);
      });
    }
  }

  // ==========================================
  // PANEL DE ADMINISTRADOR (Captura 4)
  // ==========================================

  renderAdminMetrics() {
    const metrics = window.db.get('metrics', {
      salesToday: 1450.00,
      activeOrders: 12,
      tablesOccupied: '8 / 15',
      avgTime: '14 min'
    });

    const elSales = document.getElementById('metric-sales');
    const elOrders = document.getElementById('metric-active-orders');
    const elTables = document.getElementById('metric-tables');
    const elTime = document.getElementById('metric-avg-time');

    if (elSales) elSales.textContent = `S/ ${metrics.salesToday.toFixed(2)}`;
    if (elOrders) elOrders.textContent = metrics.activeOrders;
    if (elTables) elTables.textContent = metrics.tablesOccupied;
    if (elTime) elTime.textContent = metrics.avgTime;
  }

  // ==========================================
  // GESTIÓN DE PERSONAL (Captura 2)
  // ==========================================

  renderStaffList() {
    const container = document.getElementById('staff-cards-container');
    if (!container) return;

    const staff = window.db.get('staff', []);
    container.innerHTML = staff.map(s => `
      <div class="staff-card">
        <div class="staff-header-line">
          <span class="staff-name-text">${s.name}</span>
          <span class="${s.status === 'Activo' ? 'badge-staff-active' : 'badge-staff-inactive'}">
            ${s.status}
          </span>
        </div>
        <div class="staff-meta-text">${s.email}</div>
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

  markKdsReady(orderId) {
    const card = document.getElementById(`kds-card-${orderId}`);
    if (card) {
      const btn = card.querySelector('button');
      if (btn) {
        btn.textContent = '✓ Plato Listo (Entregado al Mozo)';
        btn.disabled = true;
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

    this.showToast('✅ Mesa 04 marcada como LISTA para entrega!');
  }

  markKdsCooking(orderId) {
    const card = document.getElementById(`kds-card-${orderId}`);
    if (card) {
      const btn = card.querySelector('button');
      if (btn) {
        btn.className = 'btn-kds-ready';
        btn.textContent = '¡Plato Listo!';
        btn.setAttribute('onclick', `app.markKdsReady('${orderId}')`);
      }
    }
    this.showToast('🍳 Mesa 08 ahora está en preparación en Wok.');
  }

  // ==========================================
  // CARTA DIGITAL QR (Captura 5)
  // ==========================================

  renderMenuDishes(query = '') {
    const container = document.getElementById('menu-dishes-container');
    if (!container) return;

    let dishes = window.db.get('dishes', []);

    if (this.activeCategory !== 'Todos') {
      dishes = dishes.filter(d => d.category === this.activeCategory);
    }

    if (query.trim()) {
      const q = query.toLowerCase();
      dishes = dishes.filter(d => d.name.toLowerCase().includes(q) || d.description.toLowerCase().includes(q));
    }

    container.innerHTML = dishes.map(d => `
      <div class="dish-item-card">
        <img src="${d.image}" alt="${d.name}" class="dish-img-thumb">
        <div class="flex-grow-1">
          <div class="dish-name-title">${d.name}</div>
          <div class="dish-desc-text">${d.description}</div>
          <div class="d-flex justify-content-between align-items-center">
            <span class="dish-price-text">S/ ${d.price.toFixed(2)}</span>
            <button type="button" class="btn-add-dish" onclick="app.addToCart('${d.id}', '${d.name}', ${d.price})">+</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  filterCategory(category, btn) {
    this.activeCategory = category;
    document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
    if (btn) btn.classList.add('active');
    this.renderMenuDishes();
  }

  searchMenu(query) {
    this.renderMenuDishes(query);
  }

  addToCart(id, name, price) {
    this.cart.push({ id, name, price });
    this.updateCartBar();
    this.showToast(`+1 ${name} añadido al pedido`);
  }

  updateCartBar() {
    const countEl = document.getElementById('cart-item-count');
    const totalEl = document.getElementById('cart-total-amount');
    const total = this.cart.reduce((sum, item) => sum + item.price, 0);

    if (countEl) countEl.textContent = `${this.cart.length} items`;
    if (totalEl) totalEl.textContent = `S/ ${total.toFixed(2)}`;
  }

  // ==========================================
  // ACCIONES GENERALES
  // ==========================================

  quickLogin(email) {
    const user = (window.db.get('users', [])).find(u => u.email === email);
    if (user) {
      window.AuthService.login(user.email, user.password).then(loggedUser => {
        this.showToast(`Acceso directo como ${loggedUser.name}`);
        if (loggedUser.role === 'ADMIN') {
          this.showScreen('admin');
        } else if (loggedUser.role === 'CHEF') {
          this.showScreen('kds');
        } else {
          this.showScreen('admin');
        }
      });
    }
  }

  logout() {
    window.AuthService.logout();
    this.showToast('Sesión finalizada');
    this.showScreen('login');
  }

  showToast(message) {
    const toastEl = document.getElementById('liveToast');
    const toastMsg = document.getElementById('toastMessage');
    if (toastEl && toastMsg) {
      toastMsg.textContent = message;
      const bsToast = new bootstrap.Toast(toastEl, { delay: 2800 });
      bsToast.show();
    }
  }

  initLiveClock() {
    const update = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const kdsClock = document.getElementById('kds-clock');
      if (kdsClock) kdsClock.textContent = `${h}:${m} PM`;
    };
    update();
    setInterval(update, 1000);
  }
}

// Inicialización global
document.addEventListener('DOMContentLoaded', () => {
  window.app = new AppController();
});
