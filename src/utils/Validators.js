/**
 * Validators.js - Validadores de entrada de datos y sanitización
 */

export class Validators {
  /**
   * Valida si un string tiene formato de correo electrónico válido
   * @param {string} email
   * @returns {boolean}
   */
  static isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return regex.test(email.trim());
  }

  /**
   * Valida los requisitos de seguridad de una contraseña
   * @param {string} password
   * @returns {{isValid: boolean, errors: string[], score: number}}
   */
  static validatePassword(password) {
    const errors = [];
    if (!password || typeof password !== 'string') {
      return { isValid: false, errors: ['La contraseña es obligatoria'], score: 0 };
    }

    if (password.length < 6) {
      errors.push('Debe tener al menos 6 caracteres');
    }

    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    return {
      isValid: errors.length === 0,
      errors,
      score // 0-5
    };
  }

  /**
   * Sanitiza cadenas de texto para prevenir inyección HTML básica
   * @param {string} input
   * @returns {string}
   */
  static sanitize(input) {
    if (typeof input !== 'string') return '';
    return input
      .trim()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
