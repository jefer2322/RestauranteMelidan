/**
 * auth.js - Servicio de Autenticación y Sesiones de Melidan
 * Conectado a la Base de Datos PostgreSQL 18 (melidan_db).
 */

class AuthService {
  static SESSION_KEY = 'melidan_auth_user';
  static API_URL = 'api/auth.php';

  /**
   * Valida credenciales e inicia sesión contra PostgreSQL
   * @param {string} email
   * @param {string} password
   */
static async login(email, password) {
    const cleanEmail = (email || '').trim().toLowerCase();

    // Validar que el correo no esté vacío
    if (!cleanEmail) {
        throw new Error('Ingresa un correo electrónico.');
    }

    // Validar formato del correo
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(cleanEmail)) {
        throw new Error('Ingresa un correo electrónico válido, por ejemplo: usuario@gmail.com');
    }

    // Validar que la contraseña no esté vacía
    if (!password) {
        throw new Error('Ingresa tu contraseña.');
    }
    // 1. Intentar autenticar contra PostgreSQL
    if (window.db && window.db.isPostgresConnected) {
      try {
        const response = await fetch(`${this.API_URL}?action=login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, password: password })
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Error de autenticación');
        }

        // Guardar sesión activa obtenida desde PostgreSQL
        const sessionUser = result.user;
        localStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionUser));
        return sessionUser;
      } catch (err) {
        // Si fue un error de credenciales incorrectas, propagarlo de inmediato
        if (err.message.includes('incorrecta') || err.message.includes('encontrado') || err.message.includes('inactiva')) {
          throw err;
        }
        console.warn('[AuthService] Fallo conexión a API de PostgreSQL, intentando modo local:', err);
      }
    }

    // 2. Fallback a LocalStorage si el servidor no responde
    const user = await window.db.findOne('users', { email: cleanEmail });
    if (!user || user.password !== password) {
      throw new Error('Credenciales incorrectas. Verifica correo o contraseña.');
    }

    const sessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      source: 'local_storage'
    };
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionUser));
    return sessionUser;
  }

  /**
   * Obtiene el usuario autenticado actual o null
   */
  static getCurrentUser() {
    try {
      const data = localStorage.getItem(this.SESSION_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Cierra la sesión
   */
  static logout() {
    localStorage.removeItem(this.SESSION_KEY);
  }

  /**
   * Envía código de verificación de 6 dígitos (guardado en PostgreSQL)
   * @param {string} email
   */
  static async sendOtpCode(email) {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) throw new Error('Ingresa un correo electrónico.');

    if (window.db && window.db.isPostgresConnected) {
      try {
        const response = await fetch(`${this.API_URL}?action=request_reset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail })
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Error solicitando código');
        }
        return { code: result.code, message: result.message };
      } catch (err) {
        if (err.message.includes('No existe') || err.message.includes('correo')) throw err;
        console.warn('[AuthService] Fallback local para recuperación');
      }
    }

    // Fallback local
    const user = await window.db.findOne('users', { email: cleanEmail });
    if (!user) throw new Error('El correo no se encuentra registrado en el sistema.');

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const resets = window.db.get('password_resets', []);
    resets.unshift({ email: cleanEmail, code, expires: Date.now() + 15 * 60 * 1000 });
    window.db.set('password_resets', resets);

    return { code, message: `Código de verificación generado: ${code}` };
  }

  /**
   * Valida código de 6 dígitos contra PostgreSQL
   */
  static async verifyOtp(email, code) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanCode = (code || '').replace(/[^0-9]/g, '');

    if (window.db && window.db.isPostgresConnected) {
      try {
        const response = await fetch(`${this.API_URL}?action=verify_code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, code: cleanCode })
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Código incorrecto o expirado');
        }
        return true;
      } catch (err) {
        if (err.message.includes('inválido') || err.message.includes('expirado')) throw err;
        console.warn('[AuthService] Fallback local para verifyOtp');
      }
    }

    // Fallback local
    const resets = window.db.get('password_resets', []);
    const match = resets.find(r => r.email === cleanEmail && r.code === cleanCode && r.expires > Date.now());
    if (!match) {
      throw new Error('Código de verificación incorrecto o expirado.');
    }
    return true;
  }

  /**
   * Cambia la contraseña tras verificar el código en PostgreSQL
   */
  static async resetPassword(email, code, newPassword, confirmPassword) {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('La contraseña debe tener mínimo 6 caracteres.');
    }
    if (newPassword !== confirmPassword) {
      throw new Error('Las contraseñas no coinciden.');
    }

    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanCode = (code || '').replace(/[^0-9]/g, '');

    if (window.db && window.db.isPostgresConnected) {
      try {
        const response = await fetch(`${this.API_URL}?action=reset_password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            code: cleanCode,
            password: newPassword
          })
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Error al cambiar contraseña');
        }
        return true;
      } catch (err) {
        if (err.message.includes('La contraseña') || err.message.includes('inválido')) throw err;
        console.warn('[AuthService] Fallback local para resetPassword');
      }
    }

    // Fallback local
    await this.verifyOtp(email, code);
    const users = window.db.get('users', []);
    const updatedUsers = users.map(u => {
      if (u.email.toLowerCase() === cleanEmail) {
        return { ...u, password: newPassword };
      }
      return u;
    });
    window.db.set('users', updatedUsers);
    return true;
  }
}

window.AuthService = AuthService;
