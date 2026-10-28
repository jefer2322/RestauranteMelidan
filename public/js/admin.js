/**
 * admin.js - Lógica Integral del Módulo de Administración (Melidan)
 * CRUD Completo de Personal, Borrado Lógico (Soft Delete), Filtros y KPIs en Vivo.
 */

const adminApp = {
  staffList: [],
  currentFilter: 'todos',
  searchQuery: '',
  showDeleted: false,
  deleteTargetId: null,

  escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  async init() {
    this.setupListeners();
    this.updateActiveUserHeader();
    await Promise.all([
      this.loadDashboard(),
      this.loadStaff()
    ]);
  },

  updateActiveUserHeader() {
    try {
      const raw = localStorage.getItem('melidan_session_user');
      if (!raw) return;
      const user = JSON.parse(raw);
      const sub = document.getElementById('admin-welcome-subtitle');
      if (sub && user && user.name) {
        sub.textContent = `Bienvenido, ${user.name} (Administración General)`;
      }
    } catch (_) {}
  },

  async loadDashboard() {
    try {
      const data = await window.db.getDashboard();
      if (!data || !data.metrics) return;
      const m = data.metrics;

      const elSales = document.getElementById('stat-sales-today');
      const elTables = document.getElementById('stat-occupied-tables');
      if (elSales && m.ventas_hoy_formato) {
        elSales.textContent = m.ventas_hoy_formato;
      }
      if (elTables && m.mesas_texto) {
        elTables.textContent = m.mesas_texto;
      }
    } catch (e) {
      console.warn('[AdminApp] No se pudieron cargar métricas del dashboard:', e);
    }
  },

  async loadStaff() {
    try {
      // Traer todos los registros (incluidos soft-deleted) para calcular KPIs reales y filtrar al instante
      this.staffList = await window.db.getStaff(true);
      this.renderStaff();
      this.updateCounters();
    } catch (e) {
      console.error('[AdminApp] Error cargando personal:', e);
      this.showToast('No se pudo sincronizar el personal con PostgreSQL', 'error');
    }
  },

  updateCounters() {
    const total = this.staffList.filter(s => !s.is_deleted).length;
    const activos = this.staffList.filter(s => (s.status === 'Activo' || s.estado === 'Activo') && !s.is_deleted).length;
    const extranjeros = this.staffList.filter(s => {
      if (s.is_deleted) return false;
      const nac = (s.nacionalidad || '').toLowerCase();
      return s.es_extranjero || (nac && !['peruana', 'peru', 'perú'].includes(nac));
    }).length;
    const papelera = this.staffList.filter(s => s.is_deleted).length;

    const elTotal = document.getElementById('stat-total-staff');
    const elActivos = document.getElementById('stat-active-staff');
    const elExt = document.getElementById('stat-foreign-staff');
    const elTrash = document.getElementById('stat-trash-staff');

    if (elTotal) elTotal.textContent = total;
    if (elActivos) elActivos.textContent = activos;
    if (elExt) elExt.textContent = extranjeros;
    if (elTrash) elTrash.textContent = papelera;
  },

  renderStaff() {
    const container = document.getElementById('admin-staff-list');
    if (!container) return;

    const filtered = this.staffList.filter(user => {
      if (!this.showDeleted && user.is_deleted) return false;
      if (this.showDeleted && !user.is_deleted) return false;

      if (this.currentFilter !== 'todos') {
        const uRol = (user.rol || user.role || '').toLowerCase();
        if (this.currentFilter === 'mozo' && !uRol.includes('mozo') && !uRol.includes('waiter')) return false;
        if (this.currentFilter === 'cocina' && !uRol.includes('cocina') && !uRol.includes('chef')) return false;
        if (this.currentFilter === 'cajero' && !uRol.includes('caj') && !uRol.includes('cashier')) return false;
        if (this.currentFilter === 'recepcionista' && !uRol.includes('recep')) return false;
        if (this.currentFilter === 'administrador' && !uRol.includes('admin')) return false;
        if (this.currentFilter === 'cliente' && !uRol.includes('client')) return false;
      }

      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        const name = (user.name || user.nombre || '').toLowerCase();
        const email = (user.email || '').toLowerCase();
        const doc = (user.numero_documento || '').toLowerCase();
        const nac = (user.nacionalidad || '').toLowerCase();
        return name.includes(q) || email.includes(q) || doc.includes(q) || nac.includes(q);
      }

      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="text-center py-5">
          <i class="bi bi-people text-muted fs-1 mb-2 d-block"></i>
          <p class="text-muted fw-bold mb-1">No se encontraron registros de personal</p>
          <small class="text-secondary">${this.showDeleted ? 'La papelera de borrado lógico está vacía.' : 'Intenta con otro filtro o búsqueda.'}</small>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(u => {
      const isDel = !!u.is_deleted;
      const id = Number(u.id || u.id_usuario);
      const rawName = u.name || u.nombre || 'Usuario';
      const name = this.escapeHtml(rawName);
      const email = this.escapeHtml(u.email || '');
      const rol = this.escapeHtml(u.role || u.rol || 'Mozo');
      const docTipo = this.escapeHtml(u.tipo_documento || 'DNI');
      const docNum = this.escapeHtml(u.numero_documento || '-');
      const nacRaw = u.nacionalidad || 'Peruana';
      const nac = this.escapeHtml(nacRaw);
      const isExt = u.es_extranjero || !['peruana', 'peru', 'perú'].includes(nacRaw.toLowerCase());
      const tel = this.escapeHtml(u.telefono || '-');
      const shift = this.escapeHtml(u.shift || u.turno || 'Turno Regular');
      const isActive = (u.status || u.estado || 'Activo') === 'Activo';
      const avatar = this.escapeHtml(u.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80');
      const safeJsName = rawName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

      return `
        <div class="staff-card-item ${isDel ? 'soft-deleted' : ''}">
          <img src="${avatar}" class="staff-user-avatar" alt="${name}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'">
          <div class="staff-info-col">
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <h5 class="staff-user-name">${name}</h5>
              ${!isDel ? `<span class="badge ${isActive ? 'badge-staff-active' : 'badge-staff-inactive'}">${isActive ? 'Activo' : 'Inactivo'}</span>` : ''}
              ${isExt ? `<span class="badge badge-doc-foreign">🌍 ${nac}</span>` : ''}
              ${isDel ? `<span class="badge bg-danger" style="font-size: 0.7rem;">🗑️ Borrado Lógico</span>` : ''}
            </div>
            <p class="staff-user-email">${email} • <span class="badge badge-doc-pe">${docTipo}: ${docNum}</span></p>
            <div class="staff-user-meta">
              <span class="me-2"><i class="bi bi-person-badge me-1"></i>${rol}</span>
              <span class="me-2"><i class="bi bi-telephone me-1"></i>${tel}</span>
              <span><i class="bi bi-clock me-1"></i>${shift}</span>
            </div>
          </div>
          <div class="d-flex align-items-center gap-1 staff-actions-group">
            ${isDel ? `
              <button class="btn btn-sm btn-outline-success fw-bold" onclick="adminApp.restoreUser(${id})" title="Restaurar Usuario">
                <i class="bi bi-arrow-counterclockwise me-1"></i> Restaurar
              </button>
            ` : `
              <button class="btn btn-sm btn-melidan-outline" onclick="adminApp.openEditModal(${id})" title="Editar Datos">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger" onclick="adminApp.openDeleteModal(${id}, '${safeJsName}')" title="Archivar (Borrado Lógico)">
                <i class="bi bi-trash"></i>
              </button>
            `}
          </div>
        </div>
      `;
    }).join('');
  },

  setupListeners() {
    const searchInput = document.getElementById('admin-staff-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim();
        this.renderStaff();
      });
    }

    const trashToggle = document.getElementById('toggle-deleted-staff');
    if (trashToggle) {
      trashToggle.addEventListener('change', (e) => {
        this.showDeleted = e.target.checked;
        this.renderStaff();
      });
    }

    document.querySelectorAll('.role-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.role-pill').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.currentFilter = e.currentTarget.getAttribute('data-role');
        this.renderStaff();
      });
    });

    const formNew = document.getElementById('form-admin-new-staff');
    if (formNew) {
      formNew.addEventListener('submit', (e) => this.handleCreateUser(e));
    }

    const formEdit = document.getElementById('form-admin-edit-user');
    if (formEdit) {
      formEdit.addEventListener('submit', (e) => this.handleUpdateUser(e));
    }
  },

  handleOriginChange(origin) {
    const docSelect = document.getElementById('admin-new-doc-type');
    const docInput = document.getElementById('admin-new-doc-number');
    const docHelp = document.getElementById('admin-new-doc-help');
    const telInput = document.getElementById('admin-new-phone');
    const nacInput = document.getElementById('admin-new-nationality');

    if (origin === 'nacional') {
      if (docSelect) docSelect.innerHTML = '<option value="DNI" selected>DNI (Perú)</option>';
      if (docInput) {
        docInput.placeholder = '8 dígitos numéricos';
        docInput.maxLength = 8;
      }
      if (docHelp) docHelp.textContent = 'DNI: exactamente 8 números.';
      if (telInput) telInput.placeholder = '+51 987654321';
      if (nacInput) nacInput.value = 'Peruana';
    } else {
      if (docSelect) {
        docSelect.innerHTML = `
          <option value="PASAPORTE" selected>Pasaporte Extranjero</option>
          <option value="CARNET_EXTRANJERIA">Carné de Extranjería (CE)</option>
        `;
      }
      if (docInput) {
        docInput.placeholder = 'Nº Pasaporte (6 a 12 caracteres)';
        docInput.maxLength = 12;
      }
      if (docHelp) docHelp.textContent = 'Pasaporte: 6-12 caracteres alfanuméricos. CE: 9-12 caracteres.';
      if (telInput) telInput.placeholder = '+1 4155552671';
      if (nacInput) nacInput.value = '';
    }
  },

  async handleCreateUser(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-admin-submit-staff');
    if (btn) btn.disabled = true;

    try {
      const name = document.getElementById('admin-new-name').value.trim();
      const email = document.getElementById('admin-new-email').value.trim();
      const password = document.getElementById('admin-new-password').value || 'password123';
      const rol = document.getElementById('admin-new-role').value;
      const tipo_documento = document.getElementById('admin-new-doc-type').value;
      const numero_documento = document.getElementById('admin-new-doc-number').value.trim();
      const nacionalidad = document.getElementById('admin-new-nationality').value.trim() || 'Peruana';
      const telefono = document.getElementById('admin-new-phone').value.trim();
      const turno = document.getElementById('admin-new-shift').value;

      await window.db.createStaff({
        name,
        email,
        password,
        role: rol,
        tipo_documento,
        numero_documento,
        nacionalidad,
        telefono,
        shift: turno
      });

      this.showToast(`¡Empleado ${name} registrado con éxito!`);
      e.target.reset();
      this.handleOriginChange('nacional');
      await Promise.all([this.loadStaff(), this.loadDashboard()]);

      const modalEl = document.getElementById('adminNewStaffModal');
      if (modalEl && window.bootstrap) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
      }
    } catch (err) {
      console.error(err);
      this.showErrorModal('Error al registrar personal', err.message || 'Datos inválidos o duplicados.');
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  openEditModal(id) {
    const user = this.staffList.find(u => Number(u.id) === Number(id) || Number(u.id_usuario) === Number(id));
    if (!user) return;

    document.getElementById('edit-user-id').value = id;
    document.getElementById('edit-user-name').value = user.name || user.nombre || '';
    document.getElementById('edit-user-email').value = user.email || '';
    document.getElementById('edit-user-phone').value = user.telefono || '';
    document.getElementById('edit-user-role').value = (user.rol || user.role || 'mozo').toLowerCase();
    document.getElementById('edit-user-shift').value = user.shift || user.turno || 'Turno Mañana (8:00 AM - 4:00 PM)';
    const statusEl = document.getElementById('edit-user-status');
    if (statusEl) statusEl.value = user.status || user.estado || 'Activo';

    const modalEl = document.getElementById('editUserModal');
    if (modalEl && window.bootstrap) {
      const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
      modal.show();
    }
  },

  async handleUpdateUser(e) {
    e.preventDefault();
    const id = document.getElementById('edit-user-id').value;
    const name = document.getElementById('edit-user-name').value.trim();
    const email = document.getElementById('edit-user-email').value.trim();
    const phone = document.getElementById('edit-user-phone').value.trim();
    const role = document.getElementById('edit-user-role').value;
    const shift = document.getElementById('edit-user-shift').value;
    const statusEl = document.getElementById('edit-user-status');
    const status = statusEl ? statusEl.value : undefined;

    try {
      await window.db.updateStaff(id, {
        name,
        email,
        telefono: phone,
        role,
        shift,
        ...(status ? { status } : {})
      });

      this.showToast(`Usuario ${name} actualizado correctamente`);
      const modalEl = document.getElementById('editUserModal');
      if (modalEl && window.bootstrap) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
      }
      await Promise.all([this.loadStaff(), this.loadDashboard()]);
    } catch (err) {
      this.showErrorModal('Error al actualizar usuario', err.message);
    }
  },

  openDeleteModal(id, name) {
    this.deleteTargetId = id;
    const nameSpan = document.getElementById('delete-user-name-target');
    if (nameSpan) nameSpan.textContent = name;

    const modalEl = document.getElementById('confirmDeleteModal');
    if (modalEl && window.bootstrap) {
      const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
      modal.show();
    }
  },

  async confirmSoftDelete() {
    if (!this.deleteTargetId) return;

    try {
      await window.db.softDeleteStaff(this.deleteTargetId);
      this.showToast('Registro archivado lógicamente (preservado en PostgreSQL)');
      const modalEl = document.getElementById('confirmDeleteModal');
      if (modalEl && window.bootstrap) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
      }
      this.deleteTargetId = null;
      await Promise.all([this.loadStaff(), this.loadDashboard()]);
    } catch (err) {
      this.showErrorModal('Error en borrado lógico', err.message);
    }
  },

  async restoreUser(id) {
    try {
      await window.db.restoreStaff(id);
      this.showToast('Usuario restaurado a estado Activo exitosamente');
      await Promise.all([this.loadStaff(), this.loadDashboard()]);
    } catch (err) {
      this.showErrorModal('Error al restaurar', err.message);
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
    toast.innerHTML = `<i class="bi ${type === 'error' ? 'bi-exclamation-triangle-fill text-danger' : 'bi-check-circle-fill text-success'}"></i> <span>${this.escapeHtml(msg)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('toast-leaving');
      setTimeout(() => toast.remove(), 220);
    }, 3200);
  },

  showErrorModal(title, msg) {
    const modalEl = document.getElementById('httpErrorModal');
    if (modalEl) {
      document.getElementById('http-error-title').textContent = title;
      document.getElementById('http-error-message').textContent = msg;
      if (window.bootstrap) {
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
      } else {
        alert(`${title}: ${msg}`);
      }
    } else {
      alert(`${title}: ${msg}`);
    }
  }
};

document.addEventListener('DOMContentLoaded', () => adminApp.init());

