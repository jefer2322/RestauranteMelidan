/**
 * StorageAdapter.js - Adaptador de persistencia para el sistema
 * Provee almacenamiento persistente con localStorage y fallback automático en memoria.
 */

export class StorageAdapter {
  constructor(storageKeyPrefix = 'melidan_') {
    this.prefix = storageKeyPrefix;
    this.memoryFallback = new Map();
    this.isLocalStorageAvailable = this.checkAvailability();
  }

  /**
   * Comprueba si localStorage está disponible y habilitado en el entorno
   * @private
   */
  checkAvailability() {
    try {
      const testKey = '__storage_test__';
      window.localStorage.setItem(testKey, testKey);
      window.localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      console.warn('[StorageAdapter] localStorage no disponible. Usando memoria volátil de respaldo.', e);
      return false;
    }
  }

  /**
   * Formatea la clave con el prefijo de la aplicación
   * @private
   */
  formatKey(key) {
    return `${this.prefix}${key}`;
  }

  /**
   * Guarda un elemento serializado como JSON
   * @param {string} key
   * @param {*} value
   */
  setItem(key, value) {
    const formattedKey = this.formatKey(key);
    const serialized = JSON.stringify(value);

    if (this.isLocalStorageAvailable) {
      try {
        window.localStorage.setItem(formattedKey, serialized);
        return;
      } catch (e) {
        console.error('[StorageAdapter] Error al escribir en localStorage:', e);
      }
    }
    this.memoryFallback.set(formattedKey, serialized);
  }

  /**
   * Obtiene y parsea un elemento desde el almacenamiento
   * @param {string} key
   * @param {*} defaultValue
   * @returns {*}
   */
  getItem(key, defaultValue = null) {
    const formattedKey = this.formatKey(key);

    if (this.isLocalStorageAvailable) {
      try {
        const item = window.localStorage.getItem(formattedKey);
        if (item !== null) {
          return JSON.parse(item);
        }
      } catch (e) {
        console.error('[StorageAdapter] Error al leer de localStorage:', e);
      }
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

  /**
   * Elimina un elemento por clave
   * @param {string} key
   */
  removeItem(key) {
    const formattedKey = this.formatKey(key);
    if (this.isLocalStorageAvailable) {
      try {
        window.localStorage.removeItem(formattedKey);
      } catch (e) {
        console.error('[StorageAdapter] Error al remover de localStorage:', e);
      }
    }
    this.memoryFallback.delete(formattedKey);
  }

  /**
   * Limpia todos los elementos gestionados por este adaptador
   */
  clear() {
    if (this.isLocalStorageAvailable) {
      try {
        const keysToRemove = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k && k.startsWith(this.prefix)) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach(k => window.localStorage.removeItem(k));
      } catch (e) {
        console.error('[StorageAdapter] Error al limpiar localStorage:', e);
      }
    }
    this.memoryFallback.clear();
  }
}
