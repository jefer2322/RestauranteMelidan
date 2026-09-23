/**
 * LoginController.js - Controlador Mobile-First de Melidan App para Producción
 * Maneja el flujo de acceso (Login + Recuperación 3 Pasos) y la transición
 * a la pantalla principal autenticada del restaurante.
 */

import { db } from '../core/Database.js';
import { AuthService } from '../services/AuthService.js';
import { AuditService } from '../services/AuditService.js';

export class LoginController {
  constructor() {
    this.currentRecoveryEmail = '';
    this.currentRecoveryCode = '';
    this.elements = {};
    this.init();
  }

  async init() {
    this.cacheElements();
    this.bindEvents();

    try {
      await db.init();
    } catch (err) {
      console.error('[LoginController] Error al inicializar DB:', err);
    }

    await this.checkCurrentSession();
  }

  cacheElements() {
    this.elements = {
      // Contenedores principales
      authContainer: document.getElementById('auth-flow-container'),
      appHomeScreen: document.getElementById('app-home-screen'),
      alertBox: document.getElementById('app-alert-banner'),

      // Pantallas de autenticación
      screens: {
        login: document.getElementById('screen-login'),
        step1: document.getElementById('screen-forgot-step1'),
        step2: document.getElementById('screen-forgot-step2'),
        step3: document.getElementById('screen-forgot-step3')
      },

      // Formulario 1: Login
      formLogin: document.getElementById('form-login'),
      loginEmail: document.getElementById('login-email'),
      loginPassword: document.getElementById('login-password'),
      btnLoginSubmit: document.getElementById('btn-login-submit'),
      linkToForgot: document.getElementById('link-to-forgot'),

      // Formulario 2: Enviar Código
      formForgotStep1: document.getElementById('form-forgot-step1'),
      forgotEmail: document.getElementById('forgot-email'),
      btnSendCode: document.getElementById('btn-send-code'),

      // Formulario 3: Verificar Código
      formForgotStep2: document.getElementById('form-forgot-step2'),
      otpCodeInput: document.getElementById('otp-code'),
      btnVerifyCode: document.getElementById('btn-verify-code'),

      // Formulario 4: Cambiar Contraseña
      formForgotStep3: document.getElementById('form-forgot-step3'),
      newPasswordInput: document.getElementById('new-password'),
      confirmPasswordInput: document.getElementById('confirm-password'),
      btnChangePassword: document.getElementById('btn-change-password'),

      // Enlaces de retorno
      backLinks: document.querySelectorAll('.link-back-to-login'),

      // Elementos del Dashboard Autenticado
      homeUserAvatar: document.getElementById('home-user-avatar'),
      homeUserName: document.getElementById('home-user-name'),
      homeUserRole: document.getElementById('home-user-role'),
      homeRoleHint: document.getElementById('home-role-hint'),
      homeAuditList: document.getElementById('home-audit-list'),
      btnHomeLogout: document.getElementById('btn-home-logout'),

      // Panel Flotante de Pruebas de Roles
      btnTesterTrigger: document.getElementById('btn-tester-trigger'),
      devTesterPanel: document.getElementById('dev-tester-panel'),
      btnCloseTester: document.getElementById('btn-close-tester'),
      rolePills: document.querySelectorAll('.btn-dev-role')
    };
  }

  bindEvents() {
    // 1. Navegación a Recuperar Contraseña
    if (this.elements.linkToForgot) {
      this.elements.linkToForgot.addEventListener('click', (e) => {
        e.preventDefault();
        this.hideAlert();
        if (this.elements.loginEmail && this.elements.forgotEmail) {
          this.elements.forgotEmail.value = this.elements.loginEmail.value;
        }
        this.switchAuthScreen('step1');
      });
    }

    // 2. Retorno al Login
    if (this.elements.backLinks) {
      this.elements.backLinks.forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          this.hideAlert();
          this.switchAuthScreen('login');
        });
      });
    }

    // 3. Envío de Formularios
    if (this.elements.formLogin) {
      this.elements.formLogin.addEventListener('submit', (e) => this.handleLogin(e));
    }

    if (this.elements.formForgotStep1) {
      this.elements.formForgotStep1.addEventListener('submit', (e) => this.handleSendVerificationCode(e));
    }

    if (this.elements.formForgotStep2) {
      this.elements.formForgotStep2.addEventListener('submit', (e) => this.handleVerifyOtpCode(e));
    }

    if (this.elements.otpCodeInput) {
      this.elements.otpCodeInput.addEventListener('input', (e) => {
        let val = e.target.value.replace(/[^0-9]/g, '');
        if (val.length > 3) {
          val = val.substring(0, 3) + '-' + val.substring(3, 6);
        }
        e.target.value = val;
      });
    }

    if (this.elements.formForgotStep3) {
      this.elements.formForgotStep3.addEventListener('submit', (e) => this.handleChangePassword(e));
    }

    // 4. Cierre de Sesión en el Dashboard
    if (this.elements.btnHomeLogout) {
      this.elements.btnHomeLogout.addEventListener('click', () => this.handleLogout());
    }

    // 5. Drawer de Pruebas de Roles
    if (this.elements.btnTesterTrigger && this.elements.devTesterPanel) {
      this.elements.btnTesterTrigger.addEventListener('click', () => {
        this.elements.devTesterPanel.classList.toggle('open');
      });
    }

    if (this.elements.btnCloseTester && this.elements.devTesterPanel) {
      this.elements.btnCloseTester.addEventListener('click', () => {
        this.elements.devTesterPanel.classList.remove('open');
      });
    }

    if (this.elements.rolePills) {
      this.elements.rolePills.forEach(pill => {
        pill.addEventListener('click', () => {
          const email = pill.dataset.email;
          const password = pill.dataset.password;
          const name = pill.dataset.name;

          this.showAuthContainer();
          this.switchAuthScreen('login');

          if (this.elements.loginEmail) this.elements.loginEmail.value = email;
          if (this.elements.loginPassword) this.elements.loginPassword.value = password;
          if (this.elements.devTesterPanel) this.elements.devTesterPanel.classList.remove('open');

          this.hideAlert();
          this.showToast(`Credenciales cargadas: ${name}`);
        });
      });
    }
  }

  /**
   * Cambia la pantalla activa dentro del flujo de autenticación
   */
  switchAuthScreen(screenKey) {
    Object.values(this.elements.screens).forEach(screen => {
      if (screen) screen.classList.remove('active-screen');
    });

    const target = this.elements.screens[screenKey];
    if (target) {
      target.classList.add('active-screen');
    }
  }

  /**
   * Muestra el contenedor de autenticación y oculta la app principal
   */
  showAuthContainer() {
    if (this.elements.authContainer) this.elements.authContainer.style.display = 'flex';
    if (this.elements.appHomeScreen) {
      this.elements.appHomeScreen.classList.remove('active-screen');
      this.elements.appHomeScreen.style.display = 'none';
    }
  }

  /**
   * Muestra la app principal autenticada y oculta el flujo de login
   */
  showAppHomeScreen(user) {
    if (this.elements.authContainer) this.elements.authContainer.style.display = 'none';
    if (this.elements.appHomeScreen) {
      this.elements.appHomeScreen.style.display = 'flex';
      this.elements.appHomeScreen.classList.add('active-screen');
    }
    this.renderHomeDashboard(user);
  }

  async checkCurrentSession() {
    try {
      const active = await AuthService.getCurrentSession();
      if (active) {
        this.showAppHomeScreen(active.user);
      } else {
        this.showAuthContainer();
        this.switchAuthScreen('login');
      }
    } catch (e) {
      this.showAuthContainer();
      this.switchAuthScreen('login');
    }
  }

  /**
   * Proceso de Login
   */
  async handleLogin(e) {
    e.preventDefault();
    this.hideAlert();

    const email = this.elements.loginEmail.value.trim();
    const password = this.elements.loginPassword.value;
    const btn = this.elements.btnLoginSubmit;

    btn.disabled = true;
    btn.textContent = 'Verificando...';

    try {
      const result = await AuthService.login(email, password, true);
      this.showToast(`¡Bienvenido, ${result.user.name}!`);
      this.showAppHomeScreen(result.user);
    } catch (error) {
      this.showAlert(error.message, 'error');
      this.showToast(error.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Iniciar Sesión';
    }
  }

  /**
   * Paso 1 de Recuperación: Envío de código
   */
  async handleSendVerificationCode(e) {
    e.preventDefault();
    this.hideAlert();

    const email = this.elements.forgotEmail.value.trim();
    const btn = this.elements.btnSendCode;

    btn.disabled = true;
    btn.textContent = 'Enviando código...';

    try {
      const res = await AuthService.sendVerificationCode(email);
      this.currentRecoveryEmail = email;
      this.showToast(`Código generado: ${res.code}`);

      if (this.elements.otpCodeInput) {
        const formatted = res.code.substring(0, 3) + '-' + res.code.substring(3, 6);
        this.elements.otpCodeInput.value = formatted;
      }

      this.switchAuthScreen('step2');
    } catch (err) {
      this.showAlert(err.message, 'error');
      this.showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Enviar codigo de 6 digitos';
    }
  }

  /**
   * Paso 2 de Recuperación: Verificar código
   */
  async handleVerifyOtpCode(e) {
    e.preventDefault();
    this.hideAlert();

    const rawCode = this.elements.otpCodeInput.value.replace(/[^0-9]/g, '');
    const btn = this.elements.btnVerifyCode;

    btn.disabled = true;
    btn.textContent = 'Verificando...';

    try {
      await AuthService.verifyOtpCode(this.currentRecoveryEmail, rawCode);
      this.currentRecoveryCode = rawCode;
      this.showToast('Código verificado con éxito');
      this.switchAuthScreen('step3');
    } catch (err) {
      this.showAlert(err.message, 'error');
      this.showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Enviar codigo de 6 digitos';
    }
  }

  /**
   * Paso 3 de Recuperación: Cambiar contraseña
   */
  async handleChangePassword(e) {
    e.preventDefault();
    this.hideAlert();

    const newPassword = this.elements.newPasswordInput.value;
    const confirmPassword = this.elements.confirmPasswordInput.value;
    const btn = this.elements.btnChangePassword;

    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
      const res = await AuthService.resetPasswordWithOtp(
        this.currentRecoveryEmail,
        this.currentRecoveryCode,
        newPassword,
        confirmPassword
      );

      this.showToast('¡Contraseña actualizada!');
      if (this.elements.loginEmail) {
        this.elements.loginEmail.value = this.currentRecoveryEmail;
      }
      if (this.elements.loginPassword) {
        this.elements.loginPassword.value = newPassword;
      }

      this.showAlert(res.message, 'success');
      this.switchAuthScreen('login');
    } catch (err) {
      this.showAlert(err.message, 'error');
      this.showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Cambiar contraseña';
    }
  }

  /**
   * Renderiza el Dashboard Autenticado de la aplicación
   */
  async renderHomeDashboard(user) {
    if (this.elements.homeUserAvatar) {
      this.elements.homeUserAvatar.src = user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80';
    }
    if (this.elements.homeUserName) {
      this.elements.homeUserName.textContent = user.name;
    }
    if (this.elements.homeUserRole) {
      const roleMap = {
        ADMIN: '👑 Administrador',
        CHEF: '👨‍🍳 Jefe de Cocina KDS',
        WAITER: '🛎️ Mozo de Salón',
        CASHIER: '💳 Cajero / Facturación',
        DINER: '📱 Comensal'
      };
      this.elements.homeUserRole.textContent = roleMap[user.role] || user.role;
    }
    if (this.elements.homeRoleHint) {
      this.elements.homeRoleHint.textContent = `Rol activo: ${user.role}`;
    }

    // Cargar últimos eventos de auditoría de Database.js
    try {
      const logs = await AuditService.getRecentLogs(4);
      if (this.elements.homeAuditList && logs.length > 0) {
        this.elements.homeAuditList.innerHTML = logs.map(l => {
          const time = new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return `
            <div class="activity-item">
              <span class="activity-item-title">${l.details || l.eventType}</span>
              <span class="activity-item-time">${time}</span>
            </div>
          `;
        }).join('');
      }
    } catch (e) {
      console.warn('Error cargando logs:', e);
    }
  }

  /**
   * Cierre de sesión seguro
   */
  async handleLogout() {
    try {
      await AuthService.logout();
      this.showToast('Sesión cerrada con éxito');
      this.showAuthContainer();
      this.switchAuthScreen('login');
      if (this.elements.loginPassword) {
        this.elements.loginPassword.value = '';
      }
    } catch (e) {
      console.error(e);
    }
  }

  /**
   * Clic en acciones del dashboard
   */
  handleActionClick(moduleName) {
    this.showToast(`Módulo: ${moduleName} (En construcción para entrega)`);
  }

  /**
   * Navegación por pestañas inferiores (Tab Bar)
   */
  switchTab(tabName) {
    document.querySelectorAll('.nav-tab-btn').forEach(btn => btn.classList.remove('active'));
    const clickedBtn = event.currentTarget;
    if (clickedBtn) clickedBtn.classList.add('active');
    this.showToast(`Sección: ${tabName.toUpperCase()}`);
  }

  showAlert(msg, type = 'error') {
    const box = this.elements.alertBox;
    if (!box) return;
    box.className = `app-alert app-alert-${type} visible`;
    box.innerHTML = `<i class="bi bi-info-circle-fill"></i> <span>${msg}</span>`;
  }

  hideAlert() {
    const box = this.elements.alertBox;
    if (box) {
      box.className = 'app-alert';
      box.innerHTML = '';
    }
  }

  showToast(msg) {
    let oldToast = document.querySelector('.app-toast-box');
    if (oldToast) oldToast.remove();

    const toast = document.createElement('div');
    toast.className = 'app-toast-box';
    toast.innerHTML = `<i class="bi bi-check-circle-fill text-warning"></i> <span>${msg}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 3000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.loginController = new LoginController();
});
