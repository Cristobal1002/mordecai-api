import { BaseConnector } from '../base.connector.js';
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
      const message = err.response?.data?.message ?? err.message ?? 'Connection failed';
      return { ok: false, message };
    }
  }

  async syncFull() {
    return { synced: 0, errors: [] };
  }

  async syncIncremental(since) {
    return { synced: 0, errors: [] };
  }
}
