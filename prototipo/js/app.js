/**
 * Melidan - Prototipo Interactivo Completo
 * Lógica integral: Navegación, Ficha de Platos, Carrito, Pagos, KDS, Mapa de Mesas, Tracker y Personal.
 */

// Estado global de la aplicación (Prototipo)
const state = {
  activeScreen: 'login', // 'login', 'forgot', 'qr', 'menu', 'tracker', 'kds', 'admin', 'tables', 'staff'
  viewMode: 'mobile',    // 'mobile', 'expanded'
  cart: [
    { id: 1, name: 'Lomo Saltado Clásico', price: 28.00, qty: 1, notes: 'Tres Cuartos • Papas Fritas' },
    { id: 2, name: 'Ají de Gallina', price: 24.00, qty: 1, notes: 'Receta tradicional' }
  ],
  selectedCategory: 'Todos',
  searchQuery: '',
  kdsTab: 'cocinando', // 'nuevos', 'cocinando', 'listos'
  detailDish: null,
  detailQty: 1,
  staffList: [
    {
      id: 1,
      name: 'Carlos Paredes',
      status: 'Activo',
      email: 'carlos.p@melidan.com',
      shift: 'Turno Mañana (8:00 AM - 4:00 PM)'
    },
    {
      id: 2,
      name: 'María Salazar',
      status: 'Activo',
      email: 'maria.s@melidan.com',
      shift: 'Turno Tarde (4:00 PM - 12:00 AM)'
    },
    {
      id: 3,
      name: 'Jorge Ruiz',
      status: 'Inactivo',
      email: 'jorge.r@melidan.com',
      shift: 'Turno Rotativo'
    }
  ],
  tablesList: [
    { id: 1, number: 'Mesa 01', status: 'free', diners: '4 personas', time: 'Libre', waiter: '-' },
    { id: 2, number: 'Mesa 02', status: 'occupied', diners: '3 personas', time: '22 min', waiter: 'María S.', amount: 'S/ 120.00' },
    { id: 3, number: 'Mesa 03', status: 'free', diners: '2 personas', time: 'Libre', waiter: '-' },
    { id: 4, number: 'Mesa 04', status: 'occupied', diners: '2 personas', time: '14 min', waiter: 'María S.', amount: 'S/ 52.00' },
    { id: 5, number: 'Mesa 05', status: 'cleaning', diners: '4 personas', time: 'Por limpiar', waiter: 'Carlos P.' },
    { id: 6, number: 'Mesa 06', status: 'free', diners: '6 personas', time: 'Libre', waiter: '-' },
    { id: 7, number: 'Mesa 07', status: 'free', diners: '2 personas', time: 'Libre', waiter: '-' },
    { id: 8, number: 'Mesa 08', status: 'bill', diners: '4 personas', time: '45 min', waiter: 'Carlos P.', amount: 'S/ 84.00' },
    { id: 9, number: 'Mesa 09', status: 'free', diners: '4 personas', time: 'Libre', waiter: '-' },
    { id: 10, number: 'Mesa 10', status: 'occupied', diners: '5 personas', time: '18 min', waiter: 'María S.', amount: 'S/ 165.00' },
    { id: 11, number: 'Mesa 11', status: 'occupied', diners: '2 personas', time: '10 min', waiter: 'Carlos P.', amount: 'S/ 45.00' },
    { id: 12, number: 'Mesa 12', status: 'free', diners: '2 personas', time: 'Libre', waiter: '-' },
    { id: 13, number: 'Mesa 13', status: 'cleaning', diners: '4 personas', time: 'Por limpiar', waiter: 'Jorge R.' },
    { id: 14, number: 'Mesa 14', status: 'occupied', diners: '6 personas', time: '35 min', waiter: 'María S.', amount: 'S/ 210.00' },
    { id: 15, number: 'Mesa 15', status: 'free', diners: '4 personas', time: 'Libre', waiter: '-' }
  ]
};

// Platos de la Carta Digital Melidan con datos extendidos
const dishesData = [
  {
    id: 1,
    name: 'Lomo Saltado Clásico',
    category: 'Platos de Fondo',
    description: 'Trozos de lomo jugoso flameado al wok con cebolla, tomate, ají amarillo, servido con papas crujientes y arroz con choclo.',
    price: 28.00,
    popular: true,
    allergens: ['Sin Gluten'],
    hasCookingPreference: true,
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 2,
    name: 'Ají de Gallina',
    category: 'Platos de Fondo',
    description: 'Receta tradicional con crema de ají amarillo, pechuga deshilachada, nueces, huevo duro y aceituna botija.',
    price: 24.00,
    popular: true,
    allergens: ['Contiene Nueces / Pecanas'],
    hasCookingPreference: false,
    image: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 3,
    name: 'Limonada Frozen',
    category: 'Bebidas',
    description: 'Bebida refrescante de limón licuada con hielo frapé y hojas de menta fresca.',
    price: 12.00,
    popular: true,
    allergens: ['Vegano', 'Refrescante'],
    hasCookingPreference: false,
    image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 4,
    name: 'Causa Limeña de Pollo',
    category: 'Entradas',
    description: 'Masa suave de papa amarilla aliñada con ají amarillo y limón, rellena de pechuga deshilachada y palta fuerte.',
    price: 18.00,
    popular: false,
    allergens: ['Sin Gluten'],
    hasCookingPreference: false,
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 5,
    name: 'Arroz con Pato Criollo',
    category: 'Platos de Fondo',
    description: 'Pierna de pato dorada con arroz al culantro y chicha de jora, acompañado de sarsa criolla fresca.',
    price: 36.00,
    popular: false,
    allergens: ['Contiene Alcohol (Chicha de Jora)'],
    hasCookingPreference: true,
    image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 6,
    name: 'Chicha Morada Clásica',
    category: 'Bebidas',
    description: 'Refresco artesanal de maíz morado con piña, manzana, membrillo, canela y clavo de olor (Jarra 1L o Vaso).',
    price: 10.00,
    popular: false,
    allergens: ['Bebida Artesanal'],
    hasCookingPreference: false,
    image: 'https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=600&q=80'
  }
];

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initViewMode();
  renderDishes();
  updateCartUI();
  initDishDetailModal();
  initPaymentModal();
  initKdsLogic();
  initStaffLogic();
  initForgotPasswordFlow();
  renderTablesMap();
  updateClock();
  setInterval(updateClock, 1000);
});

/**
 * Control del Reloj
 */
function updateClock() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;

  document.querySelectorAll('.live-time-display').forEach(el => {
    el.textContent = timeStr;
  });
}

/**
 * Navegación y Transición entre Pantallas
 */
function switchScreen(screenName) {
  state.activeScreen = screenName;

  // Actualizar botones de la barra superior
  document.querySelectorAll('.screen-switcher-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.screen === screenName);
  });

  // Ocultar todas las pantallas y mostrar la solicitada
  document.querySelectorAll('.screen-wrapper').forEach(screen => {
    screen.classList.remove('active-screen');
  });

  const targetScreen = document.getElementById(`screen-${screenName}`);
  if (targetScreen) {
    targetScreen.classList.add('active-screen');
    targetScreen.scrollTop = 0;
  }

  // Ajustar tema de la barra de estado según el fondo
  const statusBar = document.getElementById('status-bar');
  const homeIndicator = document.getElementById('home-indicator');

  if (screenName === 'kds' || screenName === 'qr') {
    statusBar.classList.remove('light-theme');
    statusBar.classList.add('dark-theme');
    homeIndicator.classList.add('dark');
  } else {
    statusBar.classList.remove('dark-theme');
    statusBar.classList.add('light-theme');
    homeIndicator.classList.remove('dark');
  }
}

function initNavigation() {
  document.querySelectorAll('.screen-switcher-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const screen = e.currentTarget.dataset.screen;
      if (screen) switchScreen(screen);
    });
  });

  // Envío del Login
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      switchScreen('admin');
      showToast('¡Bienvenido Don Roberto! Sesión iniciada con éxito.');
    });
  }

  // Enlace "Ver todos" en Admin Salón -> lleva a KDS
  const linkViewAll = document.getElementById('link-view-kds');
  if (linkViewAll) {
    linkViewAll.addEventListener('click', (e) => {
      e.preventDefault();
      switchScreen('kds');
    });
  }
}

/**
 * Modo Marco Móvil vs Pantalla Expandida
 */
function initViewMode() {
  const btnMobile = document.getElementById('view-mobile-btn');
  const btnExpanded = document.getElementById('view-expanded-btn');
  const deviceFrame = document.getElementById('device-frame');

  if (btnMobile && btnExpanded && deviceFrame) {
    btnMobile.addEventListener('click', () => {
      btnMobile.classList.add('active', 'btn-primary');
      btnMobile.classList.remove('btn-outline-light');
      btnExpanded.classList.remove('active', 'btn-primary');
      btnExpanded.classList.add('btn-outline-light');
      deviceFrame.classList.remove('expanded-view');
      state.viewMode = 'mobile';
    });

    btnExpanded.addEventListener('click', () => {
      btnExpanded.classList.add('active', 'btn-primary');
      btnExpanded.classList.remove('btn-outline-light');
      btnMobile.classList.remove('active', 'btn-primary');
      btnMobile.classList.add('btn-outline-light');
      deviceFrame.classList.add('expanded-view');
      state.viewMode = 'expanded';
    });
  }
}

/**
 * 1. Flujo de Recuperación de Contraseña
 */
function initForgotPasswordFlow() {
  const btnSendOtp = document.getElementById('btn-send-otp');
  const step1 = document.getElementById('forgot-step-1');
  const step2 = document.getElementById('forgot-step-2');
  const btnReset = document.getElementById('btn-reset-password');

  if (btnSendOtp) {
    btnSendOtp.addEventListener('click', () => {
      step1.style.display = 'none';
      step2.style.display = 'block';
      showToast('📩 Código de verificación enviado: 847291');
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      showToast('✅ ¡Contraseña restablecida exitosamente! Redirigiendo a Login...');
      setTimeout(() => {
        step1.style.display = 'block';
        step2.style.display = 'none';
        switchScreen('login');
      }, 1200);
    });
  }
}

/**
 * 2. Renderizado de la Carta Digital y Búsqueda
 */
function renderDishes() {
  const container = document.getElementById('dishes-container');
  if (!container) return;

  const filtered = dishesData.filter(dish => {
    const matchesCat = state.selectedCategory === 'Todos' || dish.category === state.selectedCategory;
    const matchesSearch = dish.name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
                          dish.description.toLowerCase().includes(state.searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="text-center py-5 text-muted">
        <i class="bi bi-search fs-1 mb-2 d-block"></i>
        <p class="mb-0 fw-bold">No se encontraron platos</p>
        <small>Prueba con otra palabra clave o categoría</small>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(dish => `
    <div class="dish-card" onclick="openDishDetail(${dish.id})" role="button">
      <img src="${dish.image}" alt="${dish.name}" class="dish-img-thumb" loading="lazy">
      <div class="dish-info">
        <div class="dish-name">${dish.name}</div>
        <div class="dish-desc">${dish.description}</div>
        <div class="dish-price-action">
          <span class="dish-price">S/ ${dish.price.toFixed(2)}</span>
          <button class="btn-add-dish" onclick="event.stopPropagation(); quickAddDish(${dish.id})" title="Añadir directo">
            <i class="bi bi-plus"></i>
          </button>
        </div>
      </div>
    </div>
  `).join('');

  // Categorías
  document.querySelectorAll('.cat-pill').forEach(pill => {
    pill.addEventListener('click', (e) => {
      document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
      e.currentTarget.classList.add('active');
      state.selectedCategory = e.currentTarget.dataset.category;
      renderDishes();
    });
  });

  // Búsqueda
  const searchInput = document.getElementById('menu-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.trim();
      renderDishes();
    });
  }
}

/**
 * 3. Modal de Ficha Detallada del Plato y Personalización
 */
let bsDishDetailModal = null;

function initDishDetailModal() {
  const modalEl = document.getElementById('dishDetailModal');
  if (modalEl) {
    bsDishDetailModal = new bootstrap.Modal(modalEl);
  }

  // Stepper de Cantidad dentro del modal
  const btnMinus = document.getElementById('btn-decrease-qty');
  const btnPlus = document.getElementById('btn-increase-qty');
  const qtyDisplay = document.getElementById('detail-qty-display');

  if (btnMinus && btnPlus && qtyDisplay) {
    btnMinus.addEventListener('click', () => {
      if (state.detailQty > 1) {
        state.detailQty -= 1;
        qtyDisplay.textContent = state.detailQty;
        updateModalAddButtonText();
      }
    });

    btnPlus.addEventListener('click', () => {
      state.detailQty += 1;
      qtyDisplay.textContent = state.detailQty;
      updateModalAddButtonText();
    });
  }

  // Opciones de selección en el modal
  document.querySelectorAll('.option-select-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const parent = card.parentElement;
      parent.querySelectorAll('.option-select-card').forEach(c => {
        c.classList.remove('active');
        const icon = c.querySelector('i');
        if (icon) icon.className = 'bi bi-circle text-muted';
      });
      card.classList.add('active');
      const activeIcon = card.querySelector('i');
      if (activeIcon) {
        activeIcon.className = 'bi bi-check-circle-fill';
        activeIcon.style.color = 'var(--melidan-orange)';
      }
    });
  });

  // Botón "Agregar a la orden" personalizado
  const btnAddCustom = document.getElementById('btn-add-custom-dish');
  if (btnAddCustom) {
    btnAddCustom.addEventListener('click', () => {
      if (!state.detailDish) return;

      const activeCooking = document.querySelector('#section-cooking-preference .option-select-card.active');
      const cookingText = activeCooking ? activeCooking.dataset.val : '';
      const notesInput = document.getElementById('detail-kitchen-notes');
      const userNotes = notesInput ? notesInput.value.trim() : '';

      let combinedNotes = [];
      if (cookingText) combinedNotes.push(cookingText);
      if (userNotes) combinedNotes.push(userNotes);

      state.cart.push({
        id: state.detailDish.id,
        name: state.detailDish.name,
        price: state.detailDish.price,
        qty: state.detailQty,
        notes: combinedNotes.join(' • ')
      });

      updateCartUI();
      bsDishDetailModal.hide();
      showToast(`¡Añadido: ${state.detailQty}x ${state.detailDish.name}!`);
    });
  }
}

function openDishDetail(dishId) {
  const dish = dishesData.find(d => d.id === dishId);
  if (!dish) return;

  state.detailDish = dish;
  state.detailQty = 1;

  document.getElementById('detail-dish-img').src = dish.image;
  document.getElementById('detail-dish-name').textContent = dish.name;
  document.getElementById('detail-dish-category').textContent = dish.category;
  document.getElementById('detail-dish-price').textContent = `S/ ${dish.price.toFixed(2)}`;
  document.getElementById('detail-dish-desc').textContent = dish.description;
  document.getElementById('detail-qty-display').textContent = '1';

  // Alérgenos
  const allergenContainer = document.getElementById('detail-allergen-tags');
  if (allergenContainer) {
    allergenContainer.innerHTML = dish.allergens.map(a => `
      <span class="allergen-pill ${a.includes('Nueces') || a.includes('Alcohol') ? 'allergen-warning' : 'allergen-tag'}">
        <i class="bi ${a.includes('Nueces') ? 'bi-exclamation-triangle-fill' : 'bi-check2'}"></i> ${a}
      </span>
    `).join('');
  }

  // Mostrar u ocultar sección de término de carne
  const cookingSec = document.getElementById('section-cooking-preference');
  if (cookingSec) {
    cookingSec.style.display = dish.hasCookingPreference ? 'block' : 'none';
  }

  // Limpiar notas previas
  const notesInput = document.getElementById('detail-kitchen-notes');
  if (notesInput) {
    notesInput.value = dish.id === 1 ? 'SIN PECANAS (Alergia)' : '';
  }

  updateModalAddButtonText();
  if (bsDishDetailModal) bsDishDetailModal.show();
}

function updateModalAddButtonText() {
  const btn = document.getElementById('btn-add-custom-dish');
  if (btn && state.detailDish) {
    const total = state.detailDish.price * state.detailQty;
    btn.textContent = `Agregar a la orden • S/ ${total.toFixed(2)}`;
  }
}

function quickAddDish(dishId) {
  const dish = dishesData.find(d => d.id === dishId);
  if (!dish) return;

  const existing = state.cart.find(item => item.id === dishId);
  if (existing) {
    existing.qty += 1;
  } else {
    state.cart.push({
      id: dish.id,
      name: dish.name,
      price: dish.price,
      qty: 1,
      notes: ''
    });
  }

  updateCartUI();
  showToast(`¡Añadido: 1x ${dish.name}!`);
}

function updateCartUI() {
  const totalQty = state.cart.reduce((acc, item) => acc + item.qty, 0);
  const totalAmount = state.cart.reduce((acc, item) => acc + (item.price * item.qty), 0);

  const cartBar = document.getElementById('floating-cart-bar');
  const cartBadge = document.getElementById('cart-items-count');
  const cartTotal = document.getElementById('cart-total-price');

  if (cartBadge) cartBadge.textContent = `${totalQty} items`;
  if (cartTotal) cartTotal.textContent = `S/ ${totalAmount.toFixed(2)}`;

  if (cartBar) {
    cartBar.style.display = totalQty > 0 ? 'flex' : 'none';
  }
}

/**
 * 4. Modal de Pago Digital y Envío a Cocina
 */
function initPaymentModal() {
  const cartBar = document.getElementById('floating-cart-bar');
  const modalEl = document.getElementById('orderModal');
  if (!cartBar || !modalEl) return;

  const bsModal = new bootstrap.Modal(modalEl);

  cartBar.addEventListener('click', () => {
    renderCartModalContent();
    bsModal.show();
  });

  // Métodos de pago
  document.querySelectorAll('.payment-method-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.payment-method-card').forEach(c => {
        c.classList.remove('active');
        const icon = c.querySelector('i');
        if (icon) icon.className = 'bi bi-circle text-muted fs-5';
      });
      card.classList.add('active');
      const activeIcon = card.querySelector('i');
      if (activeIcon) {
        activeIcon.className = 'bi bi-check-circle-fill fs-5';
        activeIcon.style.color = 'var(--melidan-orange)';
      }
    });
  });

  // Confirmar y pagar
  const confirmBtn = document.getElementById('btn-confirm-order-payment');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      const activeMethod = document.querySelector('.payment-method-card.active');
      const methodName = activeMethod ? activeMethod.querySelector('.fw-bold').textContent : 'Digital';

      bsModal.hide();
      showToast(`¡Pago confirmado con ${methodName}! Pedido enviado a Cocina (KDS).`);

      // Redirigir a pantalla de Seguimiento (Order Tracker)
      setTimeout(() => {
        switchScreen('tracker');
      }, 900);
    });
  }
}

function renderCartModalContent() {
  const itemsContainer = document.getElementById('modal-cart-items-list');
  const modalTotal = document.getElementById('modal-cart-total');
  if (!itemsContainer || !modalTotal) return;

  const totalAmount = state.cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  modalTotal.textContent = `S/ ${totalAmount.toFixed(2)}`;

  itemsContainer.innerHTML = state.cart.map(item => `
    <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
      <div>
        <div class="fw-bold text-dark">${item.qty}x ${item.name}</div>
        ${item.notes ? `<small class="text-danger fw-bold d-block">* ${item.notes}</small>` : ''}
        <small class="text-muted">S/ ${item.price.toFixed(2)} c/u</small>
      </div>
      <span class="fw-bold text-dark">S/ ${(item.price * item.qty).toFixed(2)}</span>
    </div>
  `).join('');
}

/**
 * 5. Boleta de Venta Electrónica Digital
 */
function openReceiptModal() {
  const modalEl = document.getElementById('receiptModal');
  if (!modalEl) return;
  const bsReceipt = new bootstrap.Modal(modalEl);
  bsReceipt.show();
}

/**
 * 6. Lógica de Cocina KDS
 */
function initKdsLogic() {
  // Tabs de Cocina: Nuevos, Cocinando, Listos
  document.querySelectorAll('.kds-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.kds-tab').forEach(t => t.classList.remove('active'));
      e.currentTarget.classList.add('active');
      state.kdsTab = e.currentTarget.dataset.tab;
      filterKdsOrders();
    });
  });

  // Botón "¡Plato Listo!" en Mesa 04
  const btnReadyMesa04 = document.getElementById('btn-ready-m04');
  if (btnReadyMesa04) {
    btnReadyMesa04.addEventListener('click', (e) => {
      e.preventDefault();
      const card = document.getElementById('kds-card-mesa-04');
      if (card) {
        card.style.transition = 'all 0.3s ease';
        card.style.opacity = '0.5';
        card.style.transform = 'scale(0.98)';
        setTimeout(() => {
          showToast('✅ ¡Mesa 04 marcada como LISTA para entrega al mozo!');
          btnReadyMesa04.textContent = '✓ Entregado al Salón';
          btnReadyMesa04.disabled = true;
          btnReadyMesa04.classList.replace('btn-kds-ready', 'btn-secondary');
          card.style.opacity = '0.85';
          updateKdsCounts(1, 0, 1);

          // Actualizar stepper de la pantalla de seguimiento
          const stepReady = document.getElementById('step-ready-status');
          if (stepReady) {
            stepReady.classList.add('completed');
          }
        }, 300);
      }
    });
  }

  // Botón "Preparar Pedido" en Mesa 08
  const btnPrepMesa08 = document.getElementById('btn-prep-m08');
  if (btnPrepMesa08) {
    btnPrepMesa08.addEventListener('click', (e) => {
      e.preventDefault();
      btnPrepMesa08.classList.remove('btn-kds-prepare');
      btnPrepMesa08.classList.add('btn-kds-ready');
      btnPrepMesa08.textContent = '¡Plato Listo!';
      showToast('🍳 Mesa 08 ahora está EN PREPARACIÓN en Estación Wok.');
      updateKdsCounts(1, 1, 0);
    });
  }
}

function updateKdsCounts(nuevos, cocinando, listos) {
  const tabNuevos = document.querySelector('.kds-tab[data-tab="nuevos"]');
  const tabCocinando = document.querySelector('.kds-tab[data-tab="cocinando"]');
  const tabListos = document.querySelector('.kds-tab[data-tab="listos"]');

  if (tabNuevos) tabNuevos.textContent = `Nuevos (${nuevos})`;
  if (tabCocinando) tabCocinando.textContent = `Cocinando (${cocinando})`;
  if (tabListos) tabListos.textContent = `Listos (${listos})`;
}

function filterKdsOrders() {
  const card04 = document.getElementById('kds-card-mesa-04');
  const card08 = document.getElementById('kds-card-mesa-08');
  if (!card04 || !card08) return;

  if (state.kdsTab === 'cocinando') {
    card04.style.display = 'block';
    card08.style.display = 'block';
  } else if (state.kdsTab === 'nuevos') {
    card04.style.display = 'none';
    card08.style.display = 'block';
  } else if (state.kdsTab === 'listos') {
    card04.style.display = 'block';
    card08.style.display = 'none';
  }
}

/**
 * 7. Plano y Mapa de Mesas del Salón
 */
function renderTablesMap() {
  const container = document.getElementById('tables-grid-container');
  if (!container) return;

  container.innerHTML = state.tablesList.map(t => {
    let statusClass = `status-${t.status}`;
    return `
      <div class="table-node ${statusClass}" onclick="showTableInfo('${t.number}', '${t.status}', '${t.waiter}', '${t.amount || '-'}')">
        <div class="table-number">${t.number}</div>
        <div class="table-time">${t.time}</div>
        <div class="table-capacity">${t.diners}</div>
      </div>
    `;
  }).join('');
}

function showTableInfo(table, status, waiter, amount) {
  const statusLabels = {
    free: '🟢 Libre',
    occupied: '🟠 Ocupada (Comiendo)',
    cleaning: '🔵 Por Limpiar',
    bill: '🔴 Cuenta Solicitada'
  };
  showToast(`${table} (${statusLabels[status] || status}) • Mozo: ${waiter} • Consumo: ${amount}`);
}

/**
 * 8. Gestión de Personal y Horarios
 */
function initStaffLogic() {
  renderStaffList();

  const form = document.getElementById('form-new-staff');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('staff-name-input');
      const name = nameInput.value.trim();

      if (!name) return;

      const newStaff = {
        id: Date.now(),
        name: name,
        status: 'Activo',
        email: `${name.toLowerCase().replace(/\s+/g, '.')}@melidan.com`,
        shift: 'Turno Mañana (8:00 AM - 4:00 PM)'
      };

      state.staffList.unshift(newStaff);
      renderStaffList();
      nameInput.value = '';
      showToast(`¡Empleado ${name} registrado con éxito en el sistema!`);
    });
  }
}

function renderStaffList() {
  const container = document.getElementById('staff-list-container');
  if (!container) return;

  container.innerHTML = state.staffList.map(staff => `
    <div class="staff-card">
      <div class="staff-card-header">
        <h4 class="staff-name">${staff.name}</h4>
        <span class="${staff.status === 'Activo' ? 'badge-status-active' : 'badge-status-inactive'}">
          ${staff.status}
        </span>
      </div>
      <div class="staff-email">${staff.email}</div>
      <div class="staff-shift">${staff.shift}</div>
      <div class="staff-card-actions">
        <a class="staff-action-edit" onclick="showToast('Editando perfil de ${staff.name} (Modo Prototipo)')">Editar Perfil</a>
        <a class="staff-action-schedule" onclick="openStaffSchedule('${staff.name}')">Ver Horarios</a>
      </div>
    </div>
  `).join('');
}

function openStaffSchedule(staffName) {
  const modalEl = document.getElementById('staffScheduleModal');
  const titleEl = document.getElementById('schedule-staff-name');
  if (modalEl && titleEl) {
    titleEl.textContent = staffName;
    const bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();
  }
}

/**
 * Utilidad de Toast de notificación interactiva
 */
function showToast(message) {
  let toastContainer = document.getElementById('toast-notification-area');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-notification-area';
    toastContainer.style.position = 'fixed';
    toastContainer.style.bottom = '24px';
    toastContainer.style.right = '24px';
    toastContainer.style.zIndex = '9999';
    toastContainer.style.maxWidth = '360px';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = 'alert alert-dark text-white shadow-lg border-0 d-flex align-items-center gap-2 mb-2';
  toast.style.borderRadius = '14px';
  toast.style.background = 'rgba(15, 23, 42, 0.95)';
  toast.style.backdropFilter = 'blur(10px)';
  toast.style.boxShadow = '0 10px 25px rgba(0,0,0,0.3)';
  toast.style.animation = 'fadeInScreen 0.2s ease forwards';
  toast.innerHTML = `
    <i class="bi bi-info-circle-fill text-warning fs-5"></i>
    <div class="small fw-semibold">${message}</div>
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}
