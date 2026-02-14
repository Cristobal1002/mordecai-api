import { BaseConnector } from '../base.connector.js';
import { getConnectionTestErrorMessage } from '../connection-test-error.js';
import { createRentvineClient } from './rentvine.client.js';

export function getRentvineConnector(connection) {
  return new RentvineConnector(connection);
}

class RentvineConnector extends BaseConnector {
  async testConnection() {
    try {
      const client = createRentvineClient(this.connection?.credentials);
      await client.testAuth();
      return { ok: true };
    } catch (err) {
      const message = getConnectionTestErrorMessage(err);
      return { ok: false, message };
    }
  }

  async syncFull() {
    // TODO: fetch portfolios, residents, leases, charges, payments from Rentvine API and map to canonical shape
    return {
      debtors: [],
      leases: [],
      charges: [],
      payments: [],
      stats: {},
    };
  }

  async syncIncremental(since) {
    return { synced: 0, errors: [] };
  }
}
