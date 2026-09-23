/**
 * CryptoUtil.js - Utilidades criptográficas para el sistema Melidan
 * Implementa hashing SHA-256 usando la Web Crypto API nativa del navegador.
 */

export class CryptoUtil {
  /**
   * Genera un hash SHA-256 a partir de una cadena de texto
   * @param {string} text - Texto a hashear
   * @returns {Promise<string>} Representación hexadecimal del hash
   */
  static async sha256(text) {
    if (!text && text !== '') return '';
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Genera un salt aleatorio en formato hexadecimal
   * @param {number} bytes - Longitud en bytes (por defecto 16)
   * @returns {string}
   */
  static generateSalt(bytes = 16) {
    const array = new Uint8Array(bytes);
    crypto.getRandomValues(array);
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Genera un hash con salt para almacenar contraseñas
   * @param {string} password - Contraseña en texto plano
   * @param {string} salt - Salt único del usuario
   * @returns {Promise<string>}
   */
  static async hashPassword(password, salt) {
    return await this.sha256(`${salt}:${password}`);
  }

  /**
   * Genera un identificador único seguro (UUID v4 o alternativo)
   * @returns {string}
   */
  static generateUUID() {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Genera un token aleatorio seguro de sesión
   * @param {number} length - Longitud del token
   * @returns {string}
   */
  static generateToken(length = 32) {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = new Uint8Array(length);
    crypto.getRandomValues(values);
    return Array.from(values)
      .map(v => charset[v % charset.length])
      .join('');
  }
}
