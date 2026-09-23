/**
 * User.js - Modelo de Dominio de Usuario para Melidan
 * Encapsula validaciones de entidad, comprobación de estado de bloqueo y sanitización de datos.
 */

import { Validators } from '../utils/Validators.js';

export class User {
  constructor(data = {}) {
    this.id = data.id || null;
    this.name = data.name || '';
    this.email = (data.email || '').toLowerCase().trim();
    this.salt = data.salt || '';
    this.passwordHash = data.passwordHash || '';
    this.role = data.role || 'DINER';
    this.phone = data.phone || '';
    this.avatar = data.avatar || '';
    this.status = data.status || 'active'; // 'active', 'suspended', 'locked'
    this.failedAttempts = data.failedAttempts || 0;
    this.lockUntil = data.lockUntil ? new Date(data.lockUntil) : null;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.lastLoginAt = data.lastLoginAt || null;
  }

  /**
   * Comprueba si la cuenta se encuentra temporalmente bloqueada por exceso de intentos
   * @returns {{isLocked: boolean, remainingMinutes: number}}
   */
  checkLockStatus() {
    if (!this.lockUntil) {
      return { isLocked: false, remainingMinutes: 0 };
    }

    const now = new Date();
    if (now < this.lockUntil) {
      const remainingMs = this.lockUntil.getTime() - now.getTime();
      const remainingMinutes = Math.ceil(remainingMs / (1000 * 60));
      return { isLocked: true, remainingMinutes };
    }

    // El tiempo de bloqueo ya expiró
    return { isLocked: false, remainingMinutes: 0 };
  }

  /**
   * Valida la integridad del usuario antes de guardar
   * @returns {{isValid: boolean, errors: string[]}}
   */
  validate() {
    const errors = [];
    if (!this.name || this.name.trim().length < 2) {
      errors.push('El nombre debe tener al menos 2 caracteres.');
    }
    if (!Validators.isValidEmail(this.email)) {
      errors.push('El correo electrónico no tiene un formato válido.');
    }
    if (!this.passwordHash) {
      errors.push('La contraseña cifrada es obligatoria.');
    }
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Retorna una representación segura del usuario para la sesión y cliente (sin salt ni hash)
   * @returns {Object}
   */
  toSafeObject() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      role: this.role,
      phone: this.phone,
      avatar: this.avatar,
      status: this.status,
      lastLoginAt: this.lastLoginAt
    };
  }
}
