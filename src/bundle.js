/**
 * bundle.js - Melidan Gastronomy Suite (Standalone Mobile-First Distribution)
 * Distribución universal sin dependencias del prototipo, optimizada para celular.
 */

(function (global) {
  'use strict';

  // 1. Criptografía y Utilidades
  class CryptoUtil {
    static async sha256(text) {
      if (!text && text !== '') return '';
      if (global.crypto && global.crypto.subtle) {
        try {
          const encoder = new TextEncoder();
          const data = encoder.encode(text);
          const hashBuffer = await global.crypto.subtle.digest('SHA-256', data);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (e) {}
      }
      let hash = 0;
      for (let i = 0; i < text.length; i++) {
        hash = (hash << 5) - hash + text.charCodeAt(i);
        hash |= 0;
      }
      return 'hash_' + Math.abs(hash).toString(16);
    }

    static generateSalt(bytes = 16) {
      if (global.crypto && global.crypto.getRandomValues) {
        const array = new Uint8Array(bytes);
        global.crypto.getRandomValues(array);
        return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
      }
      return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }

    static async hashPassword(password, salt) {
      return await this.sha256(`${salt}:${password}`);
    }

    static generateToken(length = 32) {
      const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let result = '';
      if (global.crypto && global.crypto.getRandomValues) {
        const values = new Uint8Array(length);
        global.crypto.getRandomValues(values);
        for (let i = 0; i < length; i++) {
          result += charset[values[i] % charset.length];
        }
        return result;
      }
      for (let i = 0; i < length; i++) {
        result += charset.charAt(Math.floor(Math.random() * charset.length));
      }
      return result;
    }
  }

  // 2. Validadores
  class Validators {
    static isValidEmail(email) {
      if (!email || typeof email !== 'string') return false;
      const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      return regex.test(email.trim());
    }
  }

  // 3. Almacenamiento
  class StorageAdapter {
    constructor(prefix = 'melidan_') {
      this.prefix = prefix;
      this.memoryFallback = new Map();
      this.isLocalStorageAvailable = this.checkAvailability();
    }

    checkAvailability() {
      try {
        const testKey = '__storage_test__';
        global.localStorage.setItem(testKey, testKey);
        global.localStorage.removeItem(testKey);
        return true;
      } catch (e) {
        return false;
      }
    }

    formatKey(key) {
      return `${this.prefix}${key}`;
    }

    setItem(key, value) {
      const formattedKey = this.formatKey(key);
      const serialized = JSON.stringify(value);
      if (this.isLocalStorageAvailable) {
        try {
          global.localStorage.setItem(formattedKey, serialized);
          return;
        } catch (e) {}
      }
      this.memoryFallback.set(formattedKey, serialized);
    }

    getItem(key, defaultValue = null) {
      const formattedKey = this.formatKey(key);
      if (this.isLocalStorageAvailable) {
        try {
          const item = global.localStorage.getItem(formattedKey);
          if (item !== null) return JSON.parse(item);
        } catch (e) {}
      }
      if (this.memoryFallback.has(formattedKey)) {
        try {
          return JSON.parse(this.memoryFallback.get(formattedKey));
        } catch (e) {
          return defaultValue;
        }
      }
      return defaultValue;
    }

    removeItem(key) {
      const formattedKey = this.formatKey(key);
      if (this.isLocalStorageAvailable) {
        try {
          global.localStorage.removeItem(formattedKey);
        } catch (e) {}
      }
      this.memoryFallback.delete(formattedKey);
    }
  }

  // 4. Base de Datos Simulada
  class Database {
    constructor(options = {}) {
      this.dbName = options.dbName || 'melidan_db';
      this.latencyMs = options.latencyMs !== undefined ? options.latencyMs : 200;
      this.simulateLatency = options.simulateLatency !== undefined ? options.simulateLatency : true;
      this.storage = new StorageAdapter(`db_${this.dbName}_`);
      this.collections = ['users', 'roles', 'sessions', 'audit_logs', 'password_resets'];
      this.initialized = false;
    }

    async delay(ms = null) {
      if (!this.simulateLatency) return;
      const waitTime = ms !== null ? ms : this.latencyMs;
      return new Promise(resolve => setTimeout(resolve, waitTime));
    }

    async init() {
      if (this.initialized) return this;
      const existingUsers = this.storage.getItem('users');
      if (!existingUsers || !Array.isArray(existingUsers) || existingUsers.length === 0) {
        await this.seedDefaultData();
      }
      this.initialized = true;
      return this;
    }

    async seedDefaultData() {
      const defaultRoles = [
        { id: 'role_admin', code: 'ADMIN', name: 'Administrador / Dueño', permissions: ['*'] },
        { id: 'role_chef', code: 'CHEF', name: 'Jefe de Cocina / KDS', permissions: ['kds:view', 'kds:update_status'] },
        { id: 'role_waiter', code: 'WAITER', name: 'Mozo / Salón', permissions: ['tables:view', 'orders:create'] },
        { id: 'role_cashier', code: 'CASHIER', name: 'Cajero / Facturación', permissions: ['billing:close_account'] }
      ];

      const usersToSeed = [
        {
          id: 'usr_001',
          name: 'Don Roberto',
          email: 'admin@melidan.com',
          plainPassword: 'password123',
          role: 'ADMIN',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
          status: 'active'
        },
        {
          id: 'usr_002',
          name: 'Marco Antonio (Chef)',
          email: 'chef@melidan.com',
          plainPassword: 'password123',
          role: 'CHEF',
          avatar: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=150&q=80',
          status: 'active'
        },
        {
          id: 'usr_003',
          name: 'Carlos Paredes',
          email: 'carlos.p@melidan.com',
          plainPassword: 'password123',
          role: 'WAITER',
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
          status: 'active'
        },
        {
          id: 'usr_004',
          name: 'María Salazar',
          email: 'maria.s@melidan.com',
          plainPassword: 'password123',
          role: 'CASHIER',
          avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
          status: 'active'
        }
      ];

      const seededUsers = [];
      const nowIso = new Date().toISOString();

      for (const u of usersToSeed) {
        const salt = CryptoUtil.generateSalt(16);
        const passwordHash = await CryptoUtil.hashPassword(u.plainPassword, salt);
        seededUsers.push({
          id: u.id,
          name: u.name,
          email: u.email.toLowerCase().trim(),
          salt,
          passwordHash,
          role: u.role,
          avatar: u.avatar,
          status: u.status,
          failedAttempts: 0,
          lockUntil: null,
          createdAt: nowIso,
          updatedAt: nowIso,
          lastLoginAt: null
        });
      }

      this.storage.setItem('roles', defaultRoles);
      this.storage.setItem('users', seededUsers);
      this.storage.setItem('sessions', []);
      this.storage.setItem('audit_logs', []);
      this.storage.setItem('password_resets', []);
    }

    getCollection(name) {
      return this.storage.getItem(name, []);
    }

    saveCollection(name, data) {
      this.storage.setItem(name, data);
    }

    matchesQuery(doc, query) {
      if (typeof query === 'function') return query(doc);
      if (!query || Object.keys(query).length === 0) return true;
      return Object.entries(query).every(([key, val]) => {
        if (typeof val === 'string' && typeof doc[key] === 'string') {
          return doc[key].toLowerCase() === val.toLowerCase();
        }
        return doc[key] === val;
      });
    }

    async find(collectionName, query = {}) {
      await this.init();
      await this.delay();
      const items = this.getCollection(collectionName);
      return items.filter(doc => this.matchesQuery(doc, query));
    }

    async findOne(collectionName, query = {}) {
      await this.init();
      await this.delay();
      const items = this.getCollection(collectionName);
      const item = items.find(doc => this.matchesQuery(doc, query));
      return item ? JSON.parse(JSON.stringify(item)) : null;
    }

    async findById(collectionName, id) {
      return this.findOne(collectionName, { id });
    }

    async insert(collectionName, doc) {
      await this.init();
      await this.delay();
      const items = this.getCollection(collectionName);
      const nowIso = new Date().toISOString();
      const newDoc = {
        ...doc,
        id: doc.id || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        createdAt: doc.createdAt || nowIso,
        updatedAt: nowIso
      };
      items.push(newDoc);
      this.saveCollection(collectionName, items);
      return JSON.parse(JSON.stringify(newDoc));
    }

    async update(collectionName, query, updateFields) {
      await this.init();
      await this.delay();
      const items = this.getCollection(collectionName);
      let updatedCount = 0;
      const nowIso = new Date().toISOString();
      const updatedItems = items.map(doc => {
        if (this.matchesQuery(doc, query)) {
          updatedCount++;
          return {
            ...doc,
            ...updateFields,
            id: doc.id,
            createdAt: doc.createdAt,
            updatedAt: nowIso
          };
        }
        return doc;
      });
      if (updatedCount > 0) this.saveCollection(collectionName, updatedItems);
      return { updatedCount };
    }

    async delete(collectionName, query) {
      await this.init();
      await this.delay();
      const items = this.getCollection(collectionName);
      const filtered = items.filter(doc => !this.matchesQuery(doc, query));
      const deletedCount = items.length - filtered.length;
      if (deletedCount > 0) this.saveCollection(collectionName, filtered);
      return { deletedCount };
    }
  }

  const defaultDb = new Database();

  // 5. Modelos
  class User {
    constructor(data = {}) {
      this.id = data.id || null;
      this.name = data.name || '';
      this.email = (data.email || '').toLowerCase().trim();
      this.salt = data.salt || '';
      this.passwordHash = data.passwordHash || '';
      this.role = data.role || 'DINER';
      this.avatar = data.avatar || '';
      this.status = data.status || 'active';
      this.failedAttempts = data.failedAttempts || 0;
      this.lockUntil = data.lockUntil ? new Date(data.lockUntil) : null;
      this.createdAt = data.createdAt || new Date().toISOString();
      this.lastLoginAt = data.lastLoginAt || null;
    }

    checkLockStatus() {
      if (!this.lockUntil) return { isLocked: false, remainingMinutes: 0 };
      const now = new Date();
      if (now < this.lockUntil) {
        const remainingMs = this.lockUntil.getTime() - now.getTime();
        const remainingMinutes = Math.ceil(remainingMs / (1000 * 60));
        return { isLocked: true, remainingMinutes };
      }
      return { isLocked: false, remainingMinutes: 0 };
    }

    toSafeObject() {
      return {
        id: this.id,
        name: this.name,
        email: this.email,
        role: this.role,
        avatar: this.avatar,
        status: this.status,
        lastLoginAt: this.lastLoginAt
      };
    }
  }

  // 6. Servicios
  class AuditService {
    static async log({ eventType, userId = null, email = '', details = '', status = 'SUCCESS' }) {
      try {
        await defaultDb.insert('audit_logs', {
          eventType,
          userId,
          email,
          details,
          status,
          timestamp: new Date().toISOString()
        });
      } catch (e) {}
    }

    static async getRecentLogs(limit = 4) {
      const logs = await defaultDb.find('audit_logs');
      return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);
    }
  }

  class AuthService {
    static SESSION_STORAGE_KEY = 'melidan_auth_token';
    static MAX_FAILED_ATTEMPTS = 5;
    static LOCKOUT_MINUTES = 5;

    static async login(email, password, rememberMe = true) {
      const cleanEmail = (email || '').toLowerCase().trim();

      if (!cleanEmail || !Validators.isValidEmail(cleanEmail)) {
        throw new Error('Por favor, ingresa un correo electrónico válido.');
      }
      if (!password || typeof password !== 'string') {
        throw new Error('La contraseña es requerida.');
      }

      const rawUser = await defaultDb.findOne('users', { email: cleanEmail });
      if (!rawUser) {
        await AuditService.log({
          eventType: 'LOGIN_FAILED',
          email: cleanEmail,
          details: 'Intento de acceso con usuario inexistente',
          status: 'FAILURE'
        });
        throw new Error('Credenciales incorrectas. Verifica tu correo y contraseña.');
      }

      const user = new User(rawUser);
      const lockStatus = user.checkLockStatus();
      if (lockStatus.isLocked) {
        throw new Error(`Cuenta bloqueada temporalmente. Inténtalo en ${lockStatus.remainingMinutes} minuto(s).`);
      }

      const calculatedHash = await CryptoUtil.hashPassword(password, user.salt);
      const isValid = calculatedHash === user.passwordHash;

      if (!isValid) {
        const newFailedCount = (user.failedAttempts || 0) + 1;
        let lockUntilTime = null;
        let isNowLocked = false;

        if (newFailedCount >= this.MAX_FAILED_ATTEMPTS) {
          lockUntilTime = new Date(Date.now() + this.LOCKOUT_MINUTES * 60 * 1000).toISOString();
          isNowLocked = true;
        }

        await defaultDb.update('users', { id: user.id }, {
          failedAttempts: newFailedCount,
          lockUntil: lockUntilTime
        });

        if (isNowLocked) {
          throw new Error(`Superaste los 5 intentos fallidos. Cuenta bloqueada por ${this.LOCKOUT_MINUTES} minutos.`);
        } else {
          const remainingAttempts = this.MAX_FAILED_ATTEMPTS - newFailedCount;
          throw new Error(`Contraseña incorrecta. Te quedan ${remainingAttempts} intento(s) antes del bloqueo.`);
        }
      }

      const nowIso = new Date().toISOString();
      await defaultDb.update('users', { id: user.id }, {
        failedAttempts: 0,
        lockUntil: null,
        lastLoginAt: nowIso
      });

      const token = CryptoUtil.generateToken(40);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const createdSession = await defaultDb.insert('sessions', {
        token,
        userId: user.id,
        userEmail: user.email,
        role: user.role,
        userName: user.name,
        createdAt: nowIso,
        expiresAt,
        rememberMe: true
      });

      global.localStorage.setItem(this.SESSION_STORAGE_KEY, token);

      await AuditService.log({
        eventType: 'LOGIN_SUCCESS',
        userId: user.id,
        email: user.email,
        details: `Sesión iniciada con éxito (Rol: ${user.role})`,
        status: 'SUCCESS'
      });

      user.lastLoginAt = nowIso;
      return { user: user.toSafeObject(), session: createdSession, token };
    }

    static async sendVerificationCode(email) {
      const cleanEmail = (email || '').toLowerCase().trim();
      if (!Validators.isValidEmail(cleanEmail)) {
        throw new Error('Ingresa un correo electrónico con formato válido.');
      }

      const user = await defaultDb.findOne('users', { email: cleanEmail });
      if (!user) {
        throw new Error('El correo electrónico no se encuentra registrado.');
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      await defaultDb.update('password_resets', { email: cleanEmail, used: false }, { used: true });

      await defaultDb.insert('password_resets', {
        email: cleanEmail,
        userId: user.id,
        code,
        expiresAt,
        used: false
      });

      await AuditService.log({
        eventType: 'OTP_CODE_SENT',
        userId: user.id,
        email: cleanEmail,
        details: `Código de verificación de 6 dígitos generado: ${code}`,
        status: 'SUCCESS'
      });

      return {
        success: true,
        code,
        message: `Código de 6 dígitos generado para ${cleanEmail}`
      };
    }

    static async verifyOtpCode(email, code) {
      const cleanEmail = (email || '').toLowerCase().trim();
      const cleanCode = (code || '').replace(/[^0-9]/g, '');

      if (!cleanCode || cleanCode.length !== 6) {
        throw new Error('El código debe contener exactamente 6 dígitos numéricos.');
      }

      const record = await defaultDb.findOne('password_resets', {
        email: cleanEmail,
        code: cleanCode,
        used: false
      });

      if (!record) {
        throw new Error('Código de verificación incorrecto o ya utilizado.');
      }

      if (new Date() > new Date(record.expiresAt)) {
        throw new Error('El código ha expirado. Por favor solicita uno nuevo.');
      }

      return true;
    }

    static async resetPasswordWithOtp(email, code, newPassword, confirmPassword) {
      const cleanEmail = (email || '').toLowerCase().trim();
      if (!newPassword || newPassword.length < 6) {
        throw new Error('La contraseña debe tener al menos 6 caracteres.');
      }
      if (newPassword !== confirmPassword) {
        throw new Error('Las contraseñas no coinciden. Por favor verifica.');
      }

      await this.verifyOtpCode(cleanEmail, code);

      const user = await defaultDb.findOne('users', { email: cleanEmail });
      if (!user) {
        throw new Error('Usuario no encontrado.');
      }

      const newSalt = CryptoUtil.generateSalt(16);
      const newHash = await CryptoUtil.hashPassword(newPassword, newSalt);

      await defaultDb.update('users', { id: user.id }, {
        salt: newSalt,
        passwordHash: newHash,
        failedAttempts: 0,
        lockUntil: null
      });

      const cleanCode = (code || '').replace(/[^0-9]/g, '');
      await defaultDb.update('password_resets', { email: cleanEmail, code: cleanCode }, { used: true });

      await AuditService.log({
        eventType: 'PASSWORD_RESET_SUCCESS',
        userId: user.id,
        email: cleanEmail,
        details: 'Contraseña actualizada exitosamente con código de 6 dígitos.',
        status: 'SUCCESS'
      });

      return {
        success: true,
        message: '¡Contraseña actualizada con éxito! Ya puedes iniciar sesión.'
      };
    }

    static async getCurrentSession() {
      const token = global.localStorage.getItem(this.SESSION_STORAGE_KEY) || global.sessionStorage.getItem(this.SESSION_STORAGE_KEY);
      if (!token) return null;
      const sessionDoc = await defaultDb.findOne('sessions', { token });
      if (!sessionDoc) return null;
      if (new Date() > new Date(sessionDoc.expiresAt)) return null;
      const rawUser = await defaultDb.findById('users', sessionDoc.userId);
      if (!rawUser) return null;
      return { user: new User(rawUser).toSafeObject(), session: sessionDoc };
    }

    static async logout() {
      const token = global.localStorage.getItem(this.SESSION_STORAGE_KEY) || global.sessionStorage.getItem(this.SESSION_STORAGE_KEY);
      if (token) {
        await defaultDb.delete('sessions', { token });
      }
      global.localStorage.removeItem(this.SESSION_STORAGE_KEY);
      global.sessionStorage.removeItem(this.SESSION_STORAGE_KEY);
    }
  }

  // 7. Controlador de UI Mobile-First
  class LoginController {
    constructor() {
      this.currentRecoveryEmail = '';
      this.currentRecoveryCode = '';
      this.elements = {};
      this.init();
    }

    async init() {
      this.cacheElements();
      this.bindEvents();
      await defaultDb.init();
      await this.checkCurrentSession();
    }

    cacheElements() {
      this.elements = {
        authContainer: document.getElementById('auth-flow-container'),
        appHomeScreen: document.getElementById('app-home-screen'),
        alertBox: document.getElementById('app-alert-banner'),
        screens: {
          login: document.getElementById('screen-login'),
          step1: document.getElementById('screen-forgot-step1'),
          step2: document.getElementById('screen-forgot-step2'),
          step3: document.getElementById('screen-forgot-step3')
        },
        formLogin: document.getElementById('form-login'),
        loginEmail: document.getElementById('login-email'),
        loginPassword: document.getElementById('login-password'),
        btnLoginSubmit: document.getElementById('btn-login-submit'),
        linkToForgot: document.getElementById('link-to-forgot'),
        formForgotStep1: document.getElementById('form-forgot-step1'),
        forgotEmail: document.getElementById('forgot-email'),
        btnSendCode: document.getElementById('btn-send-code'),
        formForgotStep2: document.getElementById('form-forgot-step2'),
        otpCodeInput: document.getElementById('otp-code'),
        btnVerifyCode: document.getElementById('btn-verify-code'),
        formForgotStep3: document.getElementById('form-forgot-step3'),
        newPasswordInput: document.getElementById('new-password'),
        confirmPasswordInput: document.getElementById('confirm-password'),
        btnChangePassword: document.getElementById('btn-change-password'),
        backLinks: document.querySelectorAll('.link-back-to-login'),
        homeUserAvatar: document.getElementById('home-user-avatar'),
        homeUserName: document.getElementById('home-user-name'),
        homeUserRole: document.getElementById('home-user-role'),
        homeRoleHint: document.getElementById('home-role-hint'),
        homeAuditList: document.getElementById('home-audit-list'),
        btnHomeLogout: document.getElementById('btn-home-logout'),
        btnTesterTrigger: document.getElementById('btn-tester-trigger'),
        devTesterPanel: document.getElementById('dev-tester-panel'),
        btnCloseTester: document.getElementById('btn-close-tester'),
        rolePills: document.querySelectorAll('.btn-dev-role')
      };
    }

    bindEvents() {
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

      if (this.elements.backLinks) {
        this.elements.backLinks.forEach(link => {
          link.addEventListener('click', (e) => {
            e.preventDefault();
            this.hideAlert();
            this.switchAuthScreen('login');
          });
        });
      }

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

      if (this.elements.btnHomeLogout) {
        this.elements.btnHomeLogout.addEventListener('click', () => this.handleLogout());
      }

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

    switchAuthScreen(screenKey) {
      Object.values(this.elements.screens).forEach(screen => {
        if (screen) screen.classList.remove('active-screen');
      });

      const target = this.elements.screens[screenKey];
      if (target) {
        target.classList.add('active-screen');
      }
    }

    showAuthContainer() {
      if (this.elements.authContainer) this.elements.authContainer.style.display = 'flex';
      if (this.elements.appHomeScreen) {
        this.elements.appHomeScreen.classList.remove('active-screen');
        this.elements.appHomeScreen.style.display = 'none';
      }
    }

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
      } catch (e) {}
    }

    async handleLogout() {
      try {
        await AuthService.logout();
        this.showToast('Sesión cerrada con éxito');
        this.showAuthContainer();
        this.switchAuthScreen('login');
        if (this.elements.loginPassword) {
          this.elements.loginPassword.value = '';
        }
      } catch (e) {}
    }

    handleActionClick(moduleName) {
      this.showToast(`Módulo: ${moduleName} (En construcción para entrega)`);
    }

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

  global.Melidan = {
    CryptoUtil,
    Validators,
    StorageAdapter,
    Database,
    db: defaultDb,
    User,
    AuditService,
    AuthService,
    LoginController
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      global.loginController = new LoginController();
    });
  }
})(typeof window !== 'undefined' ? window : this);
