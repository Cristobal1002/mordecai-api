/**
 * Base connector — contrato que debe implementar cada PMS.
 * El core solo conoce este contrato; no sabe cómo funciona cada proveedor.
 */
export class BaseConnector {
  constructor(connection) {
    this.connection = connection;
    if (this.constructor === BaseConnector) {
      throw new Error('BaseConnector is abstract');
    }
  }

  async testConnection() {
    throw new Error('testConnection() must be implemented');
  }

  /**
   * Full sync: fetch from PMS and return normalized arrays for upsert.
   * @returns {{ debtors: Array, leases: Array, charges: Array, payments: Array, stats?: object }}
   */
  async syncFull() {
    throw new Error('syncFull() must be implemented');
  }

  async syncIncremental(since) {
    throw new Error('syncIncremental() must be implemented');
  }
}
