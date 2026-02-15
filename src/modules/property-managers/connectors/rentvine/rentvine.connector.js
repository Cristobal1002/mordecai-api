import { BaseConnector } from '../base.connector.js';
import { getConnectionTestErrorMessage } from '../connection-test-error.js';
import { createRentvineClient } from './rentvine.client.js';
import { rentvineMapper } from './rentvine.mapper.js';

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
    const client = createRentvineClient(this.connection?.credentials);
    const rawTenants = await client.getAllTenants(100);
    const debtors = rawTenants
      .map((item) => rentvineMapper.mapTenantContactToCanonicalDebtor(item))
      .filter((d) => d != null && d.externalId);

    const rawLeases = await client.getAllLeasesExport(100);
    const leases = rawLeases
      .map((item) => rentvineMapper.mapLeaseExportItemToCanonical(item))
      .filter((l) => l != null && l.externalId && l.debtorExternalId);
    const leaseBalances = rawLeases
      .map((item) => rentvineMapper.mapLeaseExportBalance(item))
      .filter((b) => b != null && b.balanceCents !== undefined);

    const propertiesByKey = new Map();
    const unitsByKey = new Map();
    for (const item of rawLeases) {
      const prop = rentvineMapper.mapLeaseExportProperty(item);
      if (prop?.externalId) propertiesByKey.set(prop.externalId, prop);
      const unit = rentvineMapper.mapLeaseExportUnit(item);
      if (unit?.externalId) unitsByKey.set(unit.externalId, unit);
    }
    const properties = [...propertiesByKey.values()];
    const units = [...unitsByKey.values()];

    return {
      debtors,
      leases,
      properties,
      units,
      charges: [],
      payments: [],
      leaseBalances: leaseBalances.length ? leaseBalances : undefined,
      stats: {
        totalDebtors: debtors.length,
        totalLeases: leases.length,
        totalProperties: properties.length,
        totalUnits: units.length,
        totalLeaseBalances: leaseBalances.length,
      },
    };
  }

  async syncIncremental(since) {
    return { synced: 0, errors: [] };
  }
}
