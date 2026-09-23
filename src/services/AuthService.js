/**
 * AuthService.js - Servicio de Autenticación y Gestión de Sesiones para Melidan
 * Maneja el flujo de login, verificación de credenciales con hashing SHA-256,
 * bloqueo por fuerza bruta, creación de tokens y persistencia de sesión.
 */

import { db } from '../core/Database.js';
import { CryptoUtil } from '../utils/CryptoUtil.js';
import { Validators } from '../utils/Validators.js';
import { User } from '../models/User.js';
import { Session } from '../models/Session.js';
import { AuditService } from './AuditService.js';

export class AuthService {
  static SESSION_STORAGE_KEY = 'melidan_auth_token';
  static MAX_FAILED_ATTEMPTS = 5;
  static LOCKOUT_MINUTES = 5;

  /**
   * Intenta autenticar a un usuario con correo y contraseña
   * @param {string} email - Correo del usuario
   * @param {string} password - Contraseña en texto plano
   * @param {boolean} [rememberMe=false] - Si se debe mantener la sesión persistente
   * @returns {Promise<{user: Object, session: Object, token: string}>}
   */
  static async login(email, password, rememberMe = false) {
    const cleanEmail = (email || '').toLowerCase().trim();

    // 1. Validaciones de formato
    if (!cleanEmail || !Validators.isValidEmail(cleanEmail)) {
      throw new Error('Por favor, ingresa un correo electrónico válido.');
    }

    if (!password || typeof password !== 'string') {
      throw new Error('La contraseña es requerida.');
    }

    // 2. Buscar usuario en la base de datos
    const rawUser = await db.findOne('users', { email: cleanEmail });

    if (!rawUser) {
      await AuditService.log({
        eventType: 'LOGIN_FAILED',
        email: cleanEmail,
        details: 'Intento de acceso con usuario inexistente',
        status: 'FAILURE'
      });
      throw new Error('Credenciales incorrectas. Verifica tu correo y contraseña.');
    }

    const userEntity = new User(rawUser);

    // 3. Comprobar si la cuenta está bloqueada por intentos fallidos
    const lockStatus = userEntity.checkLockStatus();
    if (lockStatus.isLocked) {
      await AuditService.log({
        eventType: 'LOGIN_BLOCKED',
        userId: userEntity.id,
        email: cleanEmail,
        details: `Intento de acceso en cuenta bloqueada temporalmente (${lockStatus.remainingMinutes} min restantes)`,
        status: 'WARNING'
      });
      throw new Error(
        `Cuenta temporalmente bloqueada por seguridad. Inténtalo de nuevo en ${lockStatus.remainingMinutes} minuto(s).`
      );
    }

    // 4. Verificar la contraseña mediante hashing con salt
    const calculatedHash = await CryptoUtil.hashPassword(password, userEntity.salt);
    const isValid = calculatedHash === userEntity.passwordHash;

    if (!isValid) {
      const newFailedCount = (userEntity.failedAttempts || 0) + 1;
      let lockUntilTime = null;
      let isNowLocked = false;

      if (newFailedCount >= this.MAX_FAILED_ATTEMPTS) {
        lockUntilTime = new Date(Date.now() + this.LOCKOUT_MINUTES * 60 * 1000).toISOString();
        isNowLocked = true;
      }

      await db.update('users', { id: userEntity.id }, {
        failedAttempts: newFailedCount,
        lockUntil: lockUntilTime
      });

      if (isNowLocked) {
        await AuditService.log({
          eventType: 'ACCOUNT_LOCKED',
          userId: userEntity.id,
          email: cleanEmail,
          details: `Bloqueo de cuenta activado tras ${newFailedCount} intentos fallidos seguidos.`,
          status: 'WARNING'
        });
        throw new Error(
          `Has superado el límite de 5 intentos fallidos. Tu cuenta ha sido bloqueada por ${this.LOCKOUT_MINUTES} minutos.`
        );
      } else {
        const remainingAttempts = this.MAX_FAILED_ATTEMPTS - newFailedCount;
        await AuditService.log({
          eventType: 'LOGIN_FAILED',
          userId: userEntity.id,
          email: cleanEmail,
          details: `Contraseña incorrecta. Intento ${newFailedCount} de ${this.MAX_FAILED_ATTEMPTS}`,
          status: 'FAILURE'
        });
        throw new Error(`Contraseña incorrecta. Te quedan ${remainingAttempts} intento(s) antes del bloqueo.`);
      }
    }

    // 5. Credenciales válidas: Restablecer contador y actualizar último login
    const nowIso = new Date().toISOString();
    await db.update('users', { id: userEntity.id }, {
      failedAttempts: 0,
      lockUntil: null,
      lastLoginAt: nowIso
    });

    // 6. Generar sesión y token seguro
    const token = CryptoUtil.generateToken(40);
    const expiresDays = rememberMe ? 7 : 1; // 7 días si recordó, 1 día si no
    const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000).toISOString();

    const sessionData = {
      token,
      userId: userEntity.id,
      userEmail: userEntity.email,
      role: userEntity.role,
      userName: userEntity.name,
      createdAt: nowIso,
      expiresAt,
      rememberMe: Boolean(rememberMe)
    };

    const createdSession = await db.insert('sessions', sessionData);

    // 7. Guardar token en el almacenamiento del cliente
    if (rememberMe) {
      localStorage.setItem(this.SESSION_STORAGE_KEY, token);
      sessionStorage.removeItem(this.SESSION_STORAGE_KEY);
    } else {
      sessionStorage.setItem(this.SESSION_STORAGE_KEY, token);
      localStorage.removeItem(this.SESSION_STORAGE_KEY);
    }

    // 8. Registrar log de auditoría
    await AuditService.log({
      eventType: 'LOGIN_SUCCESS',
      userId: userEntity.id,
      email: userEntity.email,
      details: `Sesión iniciada con éxito (Rol: ${userEntity.role}, Recordarme: ${rememberMe ? 'Sí' : 'No'})`,
      status: 'SUCCESS'
    });

    userEntity.lastLoginAt = nowIso;

    return {
      user: userEntity.toSafeObject(),
      session: createdSession,
      token
    };
  }

  /**
   * Obtiene la sesión activa y los datos del usuario actual
   * @returns {Promise<{user: Object, session: Object}|null>}
   */
  static async getCurrentSession() {
    const token = localStorage.getItem(this.SESSION_STORAGE_KEY) || sessionStorage.getItem(this.SESSION_STORAGE_KEY);
    if (!token) return null;

    const sessionDoc = await db.findOne('sessions', { token });
    if (!sessionDoc) {
      this.clearStorageTokens();
      return null;
    }

    const session = new Session(sessionDoc);
    if (session.isExpired()) {
      await db.delete('sessions', { token });
      this.clearStorageTokens();
      return null;
    }

    const rawUser = await db.findById('users', session.userId);
    if (!rawUser) {
      this.clearStorageTokens();
      return null;
    }

    const user = new User(rawUser);
    return {
      user: user.toSafeObject(),
      session
    };
  }

  /**
   * Cierra la sesión activa actual
   */
  static async logout() {
    const token = localStorage.getItem(this.SESSION_STORAGE_KEY) || sessionStorage.getItem(this.SESSION_STORAGE_KEY);
    if (token) {
      const session = await db.findOne('sessions', { token });
      if (session) {
        await AuditService.log({
          eventType: 'LOGOUT',
          userId: session.userId,
          email: session.userEmail,
          details: 'Sesión finalizada manualmente por el usuario.',
          status: 'SUCCESS'
        });
        await db.delete('sessions', { token });
      }
    }
    this.clearStorageTokens();
  }

  /**
   * Solicita restablecimiento de contraseña para un correo
   * @param {string} email
   * @returns {Promise<{success: boolean, resetToken: string, message: string}>}
   */
  static async requestPasswordReset(email) {
    const cleanEmail = (email || '').toLowerCase().trim();
    if (!Validators.isValidEmail(cleanEmail)) {
      throw new Error('Ingresa un correo electrónico con formato válido.');
    }

    const user = await db.findOne('users', { email: cleanEmail });
    if (!user) {
      // Por motivos de seguridad (owasp), no revelar si el correo existe o no
      return {
        success: true,
        message: 'Si el correo está registrado en Melidan, recibirás un enlace de restablecimiento.'
      };
    }

    const resetToken = CryptoUtil.generateToken(24);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hora

    await db.insert('password_resets', {
      email: cleanEmail,
      userId: user.id,
      token: resetToken,
      expiresAt,
      used: false
    });

    await AuditService.log({
      eventType: 'PASSWORD_RESET_REQUESTED',
      userId: user.id,
      email: cleanEmail,
      details: 'Solicitud de recuperación de contraseña generada.',
      status: 'SUCCESS'
    });

    return {
      success: true,
      resetToken,
      message: `Enlace de restablecimiento generado con éxito para ${cleanEmail}. (Token de prueba: ${resetToken})`
    };
  }

  /**
   * Genera y envía un código numérico de 6 dígitos para recuperación
   * @param {string} email
   * @returns {Promise<{success: boolean, code: string, message: string}>}
   */
  static async sendVerificationCode(email) {
    const cleanEmail = (email || '').toLowerCase().trim();
    if (!Validators.isValidEmail(cleanEmail)) {
      throw new Error('Ingresa un correo electrónico con formato válido.');
    }

    const user = await db.findOne('users', { email: cleanEmail });
    if (!user) {
      throw new Error('El correo electrónico no se encuentra registrado en el sistema.');
    }

    // Generar código numérico de 6 dígitos (ej: 847291)
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutos

    // Marcar códigos previos como utilizados
    await db.update('password_resets', { email: cleanEmail, used: false }, { used: true });

    await db.insert('password_resets', {
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
      message: `Código de 6 dígitos generado con éxito para ${cleanEmail}`
    };
  }

  /**
   * Valida si el código de 6 dígitos es correcto y no ha expirado
   * @param {string} email
   * @param {string} code
   * @returns {Promise<boolean>}
   */
  static async verifyOtpCode(email, code) {
    const cleanEmail = (email || '').toLowerCase().trim();
    const cleanCode = (code || '').replace(/[^0-9]/g, '');

    if (!cleanCode || cleanCode.length !== 6) {
      throw new Error('El código debe contener exactamente 6 dígitos numéricos.');
    }

    const record = await db.findOne('password_resets', {
      email: cleanEmail,
      code: cleanCode,
      used: false
    });

    if (!record) {
      throw new Error('Código de verificación incorrecto o ya utilizado.');
    }

    if (new Date() > new Date(record.expiresAt)) {
      throw new Error('El código de verificación ha expirado. Solicita uno nuevo.');
    }

    return true;
  }

  /**
   * Cambia la contraseña del usuario tras verificar el código de 6 dígitos
   * @param {string} email
   * @param {string} code
   * @param {string} newPassword
   * @param {string} confirmPassword
   * @returns {Promise<{success: boolean, message: string}>}
   */
  static async resetPasswordWithOtp(email, code, newPassword, confirmPassword) {
    const cleanEmail = (email || '').toLowerCase().trim();
    if (!newPassword || newPassword.length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres.');
    }
    if (newPassword !== confirmPassword) {
      throw new Error('Las contraseñas no coinciden. Por favor verifica.');
    }

    await this.verifyOtpCode(cleanEmail, code);

    const user = await db.findOne('users', { email: cleanEmail });
    if (!user) {
      throw new Error('Usuario no encontrado.');
    }

    // Hashear nueva contraseña con nuevo salt
    const newSalt = CryptoUtil.generateSalt(16);
    const newHash = await CryptoUtil.hashPassword(newPassword, newSalt);

    await db.update('users', { id: user.id }, {
      salt: newSalt,
      passwordHash: newHash,
      failedAttempts: 0,
      lockUntil: null
    });

    // Marcar código como usado
    const cleanCode = (code || '').replace(/[^0-9]/g, '');
    await db.update('password_resets', { email: cleanEmail, code: cleanCode }, { used: true });

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

  /**
   * Limpia los tokens de sesión en ambos almacenamientos
   * @private
   */
  static clearStorageTokens() {
    localStorage.removeItem(this.SESSION_STORAGE_KEY);
    sessionStorage.removeItem(this.SESSION_STORAGE_KEY);
  }
}
