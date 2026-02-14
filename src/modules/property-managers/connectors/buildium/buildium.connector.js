import { BaseConnector } from '../base.connector.js';
import { getConnectionTestErrorMessage } from '../connection-test-error.js';
import { createBuildiumClient } from './buildium.client.js';

export function getBuildiumConnector(connection) {
  return new BuildiumConnector(connection);
}

class BuildiumConnector extends BaseConnector {
  async testConnection() {
    try {
      const client = createBuildiumClient(this.connection?.credentials);
      await client.testAuth();
      return { ok: true };
    } catch (err) {
      const message = getConnectionTestErrorMessage(err);
      return { ok: false, message };
    }
  }

  async syncFull() {
    // TODO: fetch from Buildium API and map to canonical shape
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
