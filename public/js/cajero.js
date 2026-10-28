/**
 * cajero.js - Lógica del Módulo Cajero y Facturación Electrónica (Melidan)
 */

const cajeroApp = {
  activeBills: [],
  selectedBill: null,
  paymentMethod: 'efectivo',
  documentType: 'boleta',

  async init() {
    await this.loadBills();
    this.setupListeners();
  },

  async loadBills() {
    try {
      const orders = await window.db.getOrders();
      // Filtrar comandas pendientes de cobro (aún no pagadas en ventas)
      this.activeBills = orders
        .filter((o) => !o.pagado && o.estado !== 'cancelado')
        .map((o) => {
          const total = Number(o.total || 0);
          const isCuenta = o.estado_mesa === 'cuenta' || o.estado === 'entregado' || o.estado === 'listo';
          return {
            id: o.id_pedido,
            id_pedido: o.id_pedido,
            numero_comanda: o.numero_comanda || o.id_pedido,
            numero_mesa: o.numero_mesa || 1,
            cliente: o.nombre_cliente || 'Comensal',
            mozo: o.mozo_nombre || 'Mozo de Turno',
            total,
            subtotal: total / 1.18,
            igv: total - total / 1.18,
            estado: isCuenta ? 'cuenta' : o.estado,
            items: (o.items || []).map((i) => ({
              name: i.nombre_plato || 'Producto',
              qty: Number(i.cantidad || 1),
              price: Number(i.precio_unitario || 0)
            }))
          };
        });

      this.selectedBill = this.activeBills.length > 0 ? this.activeBills[0] : null;
      this.renderBillsList();
      this.renderCheckout();
    } catch (e) {
      console.error('[CajeroApp] Error cargando cuentas:', e);
      this.activeBills = [];
      this.selectedBill = null;
      this.renderBillsList();
      this.renderCheckout();
      this.showToast('⚠️ No se pudieron cargar las cuentas desde PostgreSQL', 'error');
    }
  },

  renderBillsList() {
    const listEl = document.getElementById('pending-bills-list');
    if (!listEl) return;

    if (this.activeBills.length === 0) {
      listEl.innerHTML = `
        <div class="card border p-4 text-center">
          <i class="bi bi-check2-circle text-success fs-1 mb-2 d-block"></i>
          <h6 class="fw-bold mb-1">Sin cuentas pendientes</h6>
          <small class="text-muted">Todas las comandas activas han sido liquidadas en caja.</small>
        </div>
      `;
      return;
    }

    listEl.innerHTML = this.activeBills.map((b) => {
      const isSelected = this.selectedBill && this.selectedBill.id === b.id;
      const isCuenta = b.estado === 'cuenta';

      return `
        <div class="bill-card-item ${isSelected ? 'selected' : ''} ${isCuenta ? 'bill-solicitada' : ''}" onclick="cajeroApp.selectBill(${b.id})">
          <div>
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <h6 class="mb-0 fw-bold">Mesa ${String(b.numero_mesa).padStart(2, '0')}</h6>
              ${isCuenta
                ? '<span class="badge bg-danger" style="font-size: 0.68rem;">🔴 Lista para Cobro</span>'
                : '<span class="badge bg-warning text-dark" style="font-size: 0.68rem;">En Consumo</span>'}
            </div>
            <small class="text-muted d-block mt-1">Comanda #${b.numero_comanda} • ${b.cliente} (${b.mozo})</small>
          </div>
          <div class="text-end">
            <div class="bill-total-amount">S/ ${b.total.toFixed(2)}</div>
            <small class="text-primary fw-bold" style="font-size: 0.72rem;">Seleccionar &rarr;</small>
          </div>
        </div>
      `;
    }).join('');
  },

  selectBill(billId) {
    this.selectedBill = this.activeBills.find((b) => b.id === billId) || null;
    this.renderBillsList();
    this.renderCheckout();
  },

  renderCheckout() {
    const mesaSpan = document.getElementById('checkout-table-title');
    const itemsContainer = document.getElementById('checkout-items-list');
    const subtotalEl = document.getElementById('checkout-subtotal');
    const igvEl = document.getElementById('checkout-igv');
    const totalEl = document.getElementById('checkout-total');
    const btnPay = document.getElementById('btn-process-payment');

    if (!this.selectedBill) {
      if (mesaSpan) mesaSpan.textContent = 'Selecciona una mesa para liquidar';
      if (itemsContainer) {
        itemsContainer.innerHTML = '<div class="text-muted small py-2 text-center">No hay ítems seleccionados.</div>';
      }
      if (subtotalEl) subtotalEl.textContent = 'S/ 0.00';
      if (igvEl) igvEl.textContent = 'S/ 0.00';
      if (totalEl) totalEl.textContent = 'S/ 0.00';
      if (btnPay) {
        btnPay.disabled = true;
        btnPay.innerHTML = '<i class="bi bi-printer me-2"></i> Sin cuenta pendiente seleccionada';
      }
      const changeSpan = document.getElementById('cash-change-display');
      if (changeSpan) {
        changeSpan.textContent = 'S/ 0.00';
        changeSpan.className = 'fw-bold text-muted fs-5';
      }
      return;
    }

    const b = this.selectedBill;
    if (mesaSpan) mesaSpan.textContent = `Mesa #${String(b.numero_mesa).padStart(2, '0')} - Comanda #${b.numero_comanda}`;
    if (subtotalEl) subtotalEl.textContent = `S/ ${b.subtotal.toFixed(2)}`;
    if (igvEl) igvEl.textContent = `S/ ${b.igv.toFixed(2)}`;
    if (totalEl) totalEl.textContent = `S/ ${b.total.toFixed(2)}`;
    if (btnPay) {
      btnPay.disabled = false;
      btnPay.innerHTML = `<i class="bi bi-printer me-2"></i> Emitir Comprobante y Cobrar S/ ${b.total.toFixed(2)}`;
    }

    if (itemsContainer) {
      itemsContainer.innerHTML = b.items.map((i) => `
        <div class="d-flex justify-content-between mb-1 small">
          <span>${i.qty}x ${i.name}</span>
          <span class="fw-bold">S/ ${(i.price * i.qty).toFixed(2)}</span>
        </div>
      `).join('');
    }

    const cashInput = document.getElementById('cash-received-input');
    if (cashInput && (parseFloat(cashInput.value) || 0) < b.total) {
      cashInput.value = Math.ceil(b.total / 10) * 10;
    }
    this.calcChange();
  },

  setPaymentMethod(method) {
    this.paymentMethod = method;
    document.querySelectorAll('.payment-method-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-method') === method);
    });

    const cashBox = document.getElementById('cash-calculator-container');
    if (cashBox) {
      cashBox.classList.toggle('d-none', method !== 'efectivo');
    }
  },

  setDocType(type) {
    this.documentType = type;
    const clientLabel = document.getElementById('doc-client-label');
    const clientInput = document.getElementById('doc-client-number');

    if (type === 'factura') {
      if (clientLabel) clientLabel.textContent = 'RUC y Razón Social *';
      if (clientInput) {
        clientInput.placeholder = 'RUC de 11 dígitos (20...)';
        clientInput.value = '20601234567';
      }
    } else {
      if (clientLabel) clientLabel.textContent = 'DNI / Documento del Cliente';
      if (clientInput) {
        clientInput.placeholder = '8 dígitos de DNI o documento';
        clientInput.value = '74589632';
      }
    }
  },

  calcChange() {
    if (!this.selectedBill) return;
    const cashInput = document.getElementById('cash-received-input');
    const changeSpan = document.getElementById('cash-change-display');
    if (!cashInput || !changeSpan) return;

    const received = parseFloat(cashInput.value) || 0;
    const total = this.selectedBill.total;
    const change = received - total;

    if (change >= 0) {
      changeSpan.textContent = `S/ ${change.toFixed(2)}`;
      changeSpan.className = 'fw-bold text-success fs-5';
    } else {
      changeSpan.textContent = `Faltan S/ ${Math.abs(change).toFixed(2)}`;
      changeSpan.className = 'fw-bold text-danger fs-6';
    }
  },

  async processPayment() {
    if (!this.selectedBill) return;
    const b = this.selectedBill;

    if (this.paymentMethod === 'efectivo') {
      const cashInput = document.getElementById('cash-received-input');
      const received = parseFloat(cashInput?.value) || 0;
      if (received < b.total) {
        this.showToast('⚠️ El monto recibido en efectivo es menor al total a cobrar.', 'error');
        return;
      }
    }

    const btnPay = document.getElementById('btn-process-payment');
    if (btnPay) btnPay.disabled = true;

    try {
      // Mapeo exacto con el ENUM metodo_pago_enum de PostgreSQL 18
      const paymentMap = {
        efectivo: 'efectivo_caja',
        tarjeta: 'tarjeta_caja',
        digital: 'aplicacion',
        aplicacion: 'aplicacion'
      };

      const result = await window.db.createReceipt({
        id_pedido: b.id_pedido,
        metodo_pago: paymentMap[this.paymentMethod] || 'efectivo_caja',
        tipo_comprobante: this.documentType
      });

      const compNum = result.numero_comprobante;
      const currentUser = window.AuthService?.getCurrentUser?.();
      const cashierName = currentUser?.name || 'María Salazar';
      const dateStr = result.fecha_formato || new Date().toLocaleString('es-PE');

      const modalReceipt = document.getElementById('receiptModal');
      const numSpan = document.getElementById('receipt-voucher-number');
      const tableSpan = document.getElementById('receipt-table-num');
      const metaSpan = document.getElementById('receipt-meta-info');
      const totalSpan = document.getElementById('receipt-total-amount');

      if (numSpan) numSpan.textContent = compNum;
      if (tableSpan) tableSpan.textContent = `Mesa #${String(b.numero_mesa).padStart(2, '0')} • Comanda #${b.numero_comanda}`;
      if (metaSpan) metaSpan.textContent = `Fecha: ${dateStr} • Caja: ${cashierName}`;
      if (totalSpan) totalSpan.textContent = `S/ ${b.total.toFixed(2)}`;

      if (modalReceipt && window.bootstrap) {
        bootstrap.Modal.getOrCreateInstance(modalReceipt).show();
      }

      await this.loadBills();
      this.showToast(`✅ Pago registrado (${compNum}). Mesa #${b.numero_mesa} pasa a "Por Limpiar".`);
    } catch (e) {
      console.error(e);
      this.showToast('⚠️ Error al registrar el pago en PostgreSQL', 'error');
      if (btnPay) btnPay.disabled = false;
    }
  },

  setupListeners() {
    document.querySelectorAll('.payment-method-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const method = e.currentTarget.getAttribute('data-method');
        this.setPaymentMethod(method);
      });
    });

    const cashInput = document.getElementById('cash-received-input');
    if (cashInput) {
      cashInput.addEventListener('input', () => this.calcChange());
    }
  },

  showToast(msg, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container-melidan';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast-melidan';
    const icon = type === 'error' ? 'bi-exclamation-triangle-fill text-danger' : 'bi-check-circle-fill text-success';
    toast.innerHTML = `<i class="bi ${icon}"></i> <span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('toast-leaving');
      setTimeout(() => toast.remove(), 220);
    }, 3500);
  }
};

document.addEventListener('DOMContentLoaded', () => cajeroApp.init());

