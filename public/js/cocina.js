/**
 * cocina.js - Lógica del Módulo Cocina / Kitchen Display System KDS (Melidan)
 */

const cocinaApp = {
  currentStation: 'todas',
  orders: [],

  async init() {
    this.startClock();
    await this.loadOrders();
    this.setupListeners();
  },

  startClock() {
    const clockEl = document.getElementById('kds-live-clock');
    if (!clockEl) return;
    const update = () => {
      const now = new Date();
      clockEl.textContent = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };
    update();
    setInterval(update, 1000);
  },

  async loadOrders() {
    try {
      const allOrders = await window.db.getOrders();
      // Mostrar comandas activas de cocina (pendiente, en_cocina, listo)
      this.orders = allOrders.filter((o) => ['pendiente', 'en_cocina', 'listo'].includes(o.estado));
      this.renderTickets();
    } catch (e) {
      console.error('[CocinaApp] Error cargando pedidos:', e);
      this.orders = [];
      this.renderTickets();
      this.showToast('⚠️ No se pudieron cargar las comandas desde PostgreSQL', 'error');
    }
  },

  matchesStation(order, stationFilter) {
    if (!stationFilter || stationFilter === 'todas') return true;
    const target = stationFilter.toLowerCase();
    const items = Array.isArray(order.items) ? order.items : [];
    return items.some((item) => {
      const est = String(item.estacion || '').toLowerCase();
      if (target === 'wok') return est.includes('wok');
      if (target === 'horno') return est.includes('horno') || est.includes('fuego');
      if (target === 'bebidas') return est.includes('bebida') || est.includes('bar');
      return est.includes(target);
    });
  },

  escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  renderTickets() {
    const grid = document.getElementById('kds-tickets-grid');
    if (!grid) return;

    const filtered = this.orders.filter((ord) => this.matchesStation(ord, this.currentStation));

    const activeCountEl = document.getElementById('kds-active-count');
    if (activeCountEl) {
      activeCountEl.textContent = `${filtered.length} Comanda${filtered.length === 1 ? '' : 's'}`;
    }

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="col-12 text-center py-5" style="grid-column: 1 / -1;">
          <i class="bi bi-check2-circle text-success fs-1 mb-2 d-block"></i>
          <h4 class="fw-bold">¡Estación al día!</h4>
          <p class="text-muted mb-0">No hay comandas pendientes para esta estación.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map((o) => {
      const orderId = o.id_pedido || o.id || o.numero_comanda;
      const elapsed = Number(o.minutos_transcurridos ?? o.tiempo_min ?? 5);
      const isUrgent = elapsed > 15 && o.estado !== 'listo';
      const isReady = o.estado === 'listo';
      const timerClass = isReady ? 'normal' : (isUrgent ? 'danger' : (elapsed > 8 ? 'warning' : 'normal'));
      const hora = this.escapeHtml(o.hora_formato || o.hora || 'Ahora');
      const items = Array.isArray(o.items) ? o.items : [];

      return `
        <div class="kds-ticket ${isUrgent ? 'urgente' : ''}">
          <div class="kds-ticket-header">
            <div>
              <div class="kds-mesa-badge">Mesa #${String(o.numero_mesa || 1).padStart(2, '0')}</div>
              <small class="text-muted">Comanda #${this.escapeHtml(o.numero_comanda || orderId)} • ${hora}</small>
            </div>
            <span class="kds-timer-badge ${timerClass}">
              <i class="bi bi-clock-history"></i> ${elapsed} min
            </span>
          </div>

          <div class="kds-ticket-body">
            ${items.map((item) => {
              const qty = Number(item.cantidad ?? item.quantity ?? 1);
              const dishName = this.escapeHtml(item.nombre_plato || item.name || 'Plato');
              const notes = this.escapeHtml(item.observaciones || item.observations || '');
              const stationBadge = this.escapeHtml(item.estacion || item.coccion || '');
              return `
                <div class="kds-item-row">
                  <span class="kds-item-qty">${qty}x</span>
                  <div class="kds-item-name">
                    <div>${dishName}</div>
                    ${notes ? `<div class="kds-item-notes"><i class="bi bi-info-circle me-1"></i>${notes}</div>` : ''}
                  </div>
                  ${stationBadge ? `<span class="badge bg-light text-secondary border small">${stationBadge}</span>` : ''}
                </div>
              `;
            }).join('')}
          </div>

          <div class="kds-ticket-footer">
            ${isReady ? `
              <button class="btn btn-melidan-teal w-100 fw-bold py-2" onclick="cocinaApp.markDelivered(${orderId})">
                <i class="bi bi-check2-all me-1"></i> Despachar / Entregar a Mozo
              </button>
            ` : (o.estado === 'en_cocina' ? `
              <button class="btn btn-success w-100 fw-bold py-2" onclick="cocinaApp.markReady(${orderId})">
                <i class="bi bi-bell-fill me-1"></i> ¡Plato Listo! (Avisar Mozo)
              </button>
            ` : `
              <button class="btn btn-melidan-orange w-100 fw-bold py-2" onclick="cocinaApp.startPrep(${orderId})">
                <i class="bi bi-fire me-1"></i> Iniciar Preparación
              </button>
            `)}
          </div>
        </div>
      `;
    }).join('');
  },

  async startPrep(id) {
    try {
      await window.db.updateOrderStatus(id, 'en_cocina');
      await this.loadOrders();
      this.showToast(`🍳 Comanda #${id} puesta en preparación`);
    } catch (_) {
      this.showToast('⚠️ No se pudo actualizar la comanda', 'error');
    }
  },

  async markReady(id) {
    const ord = this.orders.find((o) => Number(o.id_pedido || o.id || o.numero_comanda) === Number(id));
    try {
      await window.db.updateOrderStatus(id, 'listo');
      await this.loadOrders();
      this.showToast(`🔔 ¡Mesa #${ord?.numero_mesa || ''} marcada como LISTA para el mozo!`);
    } catch (_) {
      this.showToast('⚠️ No se pudo actualizar la comanda', 'error');
    }
  },

  async markDelivered(id) {
    try {
      await window.db.updateOrderStatus(id, 'entregado');
      await this.loadOrders();
      this.showToast(`✅ Comanda #${id} despachada a salón`);
    } catch (_) {
      this.showToast('⚠️ No se pudo despachar la comanda', 'error');
    }
  },

  setupListeners() {
    document.querySelectorAll('.station-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.station-btn').forEach((b) => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.currentStation = e.currentTarget.getAttribute('data-station') || 'todas';
        this.renderTickets();
      });
    });
  },

  showToast(msg, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container-melidan';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast-melidan';
    const icon = type === 'error' ? 'bi-exclamation-triangle-fill text-danger' : 'bi-bell-fill text-warning';
    toast.innerHTML = `<i class="bi ${icon}"></i> <span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('toast-leaving');
      setTimeout(() => toast.remove(), 220);
    }, 3200);
  }
};

document.addEventListener('DOMContentLoaded', () => cocinaApp.init());

