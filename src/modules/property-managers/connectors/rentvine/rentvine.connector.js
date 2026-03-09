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

    const rawPortfolios = await client.getAllPortfolios(100);
    const portfoliosFromApi = rawPortfolios
      .map((item) => rentvineMapper.mapPortfolioToCanonical(item))
      .filter((p) => p != null && p.externalId);

    const rawLeases = await client.getAllLeasesExport(100);
    const leases = rawLeases
      .map((item) => rentvineMapper.mapLeaseExportItemToCanonical(item))
      .filter((l) => l != null && l.externalId && l.debtorExternalId);
    const leaseBalances = rawLeases
      .map((item) => rentvineMapper.mapLeaseExportBalance(item))
      .filter((b) => b != null && b.balanceCents !== undefined);

    const portfoliosByKey = new Map(portfoliosFromApi.map((p) => [p.externalId, p]));
    for (const item of rawLeases) {
      const port = rentvineMapper.mapPortfolioToCanonical(item?.portfolio ?? item);
      if (port?.externalId) portfoliosByKey.set(port.externalId, port);
    }
    const portfolios = [...portfoliosByKey.values()];

    const propertiesByKey = new Map();
    const unitsByKey = new Map();
    const charges = [];
    for (const item of rawLeases) {
      const prop = rentvineMapper.mapLeaseExportProperty(item);
      if (prop?.externalId) propertiesByKey.set(prop.externalId, prop);
      const unit = rentvineMapper.mapLeaseExportUnit(item);
      if (unit?.externalId) unitsByKey.set(unit.externalId, unit);
      const itemCharges = rentvineMapper.mapLeaseExportUnpaidCharges(item);
      charges.push(...itemCharges);
    }
    const properties = [...propertiesByKey.values()];
    const units = [...unitsByKey.values()];

    const unitToLeaseMap = rentvineMapper.buildUnitToLeaseMap(rawLeases);
    const rawPayments = await client.getAllTransactions(2);
    const payments = rawPayments
      .map((item) => rentvineMapper.mapTransactionToCanonicalPayment(item, unitToLeaseMap))
      .filter((p) => p != null && p.externalId);

    return {
      debtors,
      portfolios,
      leases,
      properties,
      units,
      charges,
      payments,
      leaseBalances: leaseBalances.length ? leaseBalances : undefined,
      stats: {
        totalDebtors: debtors.length,
        totalPortfolios: portfolios.length,
        totalLeases: leases.length,
        totalProperties: properties.length,
        totalUnits: units.length,
        totalCharges: charges.length,
        totalPayments: payments.length,
        totalLeaseBalances: leaseBalances.length,
      },
    };
  }

  async syncIncremental(since) {
    return { synced: 0, errors: [] };
  }
}
