/**
 * auth.js - Servicio de Autenticación y Sesiones de Melidan
 * Conectado a la base de datos simulada (MelidanDB).
 */

class AuthService {
  static SESSION_KEY = 'melidan_auth_user';

  /**
   * Valida credenciales e inicia sesión
   * @param {string} email
   * @param {string} password
   */
  static async login(email, password) {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) throw new Error('Ingresa un correo electrónico.');
    if (!password) throw new Error('Ingresa tu contraseña.');

    const user = await window.db.findOne('users', { email: cleanEmail });
    if (!user || user.password !== password) {
      throw new Error('Credenciales incorrectas. Verifica correo o contraseña.');
    }

    // Guardar sesión activa
    const sessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar
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
   * Envía código de verificación de 6 dígitos
   * @param {string} email
   */
  static async sendOtpCode(email) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const user = await window.db.findOne('users', { email: cleanEmail });
    if (!user) throw new Error('El correo no se encuentra registrado en el sistema.');

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const resets = window.db.get('password_resets', []);
    resets.unshift({ email: cleanEmail, code, expires: Date.now() + 15 * 60 * 1000 });
    window.db.set('password_resets', resets);

    return { code, message: `Código de verificación generado: ${code}` };
  }

  /**
   * Valida código de 6 dígitos
   */
  static async verifyOtp(email, code) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanCode = (code || '').replace(/[^0-9]/g, '');
    const resets = window.db.get('password_resets', []);

    const match = resets.find(r => r.email === cleanEmail && r.code === cleanCode && r.expires > Date.now());
    if (!match) {
      throw new Error('Código de verificación incorrecto o expirado.');
    }
    return true;
  }

  /**
   * Cambia la contraseña tras verificar el código
   */
  static async resetPassword(email, code, newPassword, confirmPassword) {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('La contraseña debe tener mínimo 6 caracteres.');
    }
    if (newPassword !== confirmPassword) {
      throw new Error('Las contraseñas no coinciden.');
    }

    await this.verifyOtp(email, code);

    const users = window.db.get('users', []);
    const updatedUsers = users.map(u => {
      if (u.email.toLowerCase() === email.toLowerCase()) {
        return { ...u, password: newPassword };
      }
      return u;
    });

    window.db.set('users', updatedUsers);
    return true;
  }
}

window.AuthService = AuthService;
