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

  async syncFull() {
    throw new Error('syncFull() must be implemented');
  }

  async syncIncremental(since) {
    throw new Error('syncIncremental() must be implemented');
  }
}
