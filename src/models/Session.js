/**
 * Session.js - Modelo de Sesión de Usuario
 */

export class Session {
  constructor(data = {}) {
    this.id = data.id || null;
    this.token = data.token || '';
    this.userId = data.userId || null;
    this.userEmail = data.userEmail || '';
    this.role = data.role || 'DINER';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.expiresAt = data.expiresAt || null;
    this.rememberMe = Boolean(data.rememberMe);
    this.userAgent = data.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown');
  }

  /**
   * Comprueba si la sesión ha expirado
   * @returns {boolean}
   */
  isExpired() {
    if (!this.expiresAt) return false;
    return new Date() > new Date(this.expiresAt);
  }
}
