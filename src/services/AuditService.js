/**
 * AuditService.js - Servicio de Auditoría y Trazabilidad de Seguridad
 */

import { db } from '../core/Database.js';

export class AuditService {
  /**
   * Registra un evento en la colección audit_logs
   * @param {Object} entry
   * @param {string} entry.eventType - Ejemplo: 'LOGIN_SUCCESS', 'LOGIN_FAILED', 'ACCOUNT_LOCKED', 'LOGOUT'
   * @param {string} [entry.userId]
   * @param {string} entry.email
   * @param {string} entry.details
   * @param {'SUCCESS'|'FAILURE'|'WARNING'} entry.status
   */
  static async log({ eventType, userId = null, email = '', details = '', status = 'SUCCESS' }) {
    try {
      await db.insert('audit_logs', {
        eventType,
        userId,
        email,
        details,
        status,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('[AuditService] Error registrando log de auditoría:', err);
    }
  }

  /**
   * Obtiene los últimos logs registrados
   * @param {number} limit
   * @returns {Promise<Array>}
   */
  static async getRecentLogs(limit = 10) {
    const logs = await db.find('audit_logs');
    return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);
  }
}
