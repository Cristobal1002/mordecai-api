import { logger } from '../../utils/logger.js';
import { propertyManagersService } from './property-managers.service.js';

/** Remove credentials from connection payload so they are never sent to the client. */
function sanitizeConnection(connection) {
  const plain = connection?.get ? connection.get({ plain: true }) : connection;
  if (!plain) return plain;
  const activeSyncRun = plain.syncRuns?.[0]
    ? {
        id: plain.syncRuns[0].id,
        step: plain.syncRuns[0].step,
        stats: plain.syncRuns[0].stats,
        status: plain.syncRuns[0].status,
        startedAt: plain.syncRuns[0].startedAt,
      }
    : null;
  return {
    id: plain.id,
    tenantId: plain.tenantId,
    softwareId: plain.softwareId,
    status: plain.status,
    externalAccountId: plain.externalAccountId,
    capabilities: plain.capabilities,
    lastSyncedAt: plain.lastSyncedAt,
    lastError: plain.lastError,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
    software: plain.software,
    credentials: null,
    activeSyncRun,
  };
}

export const propertyManagersController = {
  listByTenant: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const data = await propertyManagersService.listByTenant(tenantId);
      const sanitized = Array.isArray(data) ? data.map(sanitizeConnection) : data;
      res.ok(sanitized, 'PMS connections retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  getById: async (req, res, next) => {
    try {
      const { tenantId, connectionId } = req.params;
      const data = await propertyManagersService.getById(tenantId, connectionId);
      res.ok(sanitizeConnection(data), 'PMS connection retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /** Returns decrypted credentials for the connection (for edit form). Requires auth. */
  getCredentials: async (req, res, next) => {
    try {
      const { tenantId, connectionId } = req.params;
      const data = await propertyManagersService.getCredentials(tenantId, connectionId);
      res.ok(data, 'Credentials retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  create: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const data = await propertyManagersService.create(tenantId, req.body);
      res.created(sanitizeConnection(data), 'PMS connection created successfully');
    } catch (error) {
      next(error);
    }
  },

  updateCredentials: async (req, res, next) => {
    try {
      const { tenantId, connectionId } = req.params;
      const data = await propertyManagersService.updateCredentials(
        tenantId,
        connectionId,
        req.body.credentials
      );
      res.ok(sanitizeConnection(data), 'Credentials updated successfully');
    } catch (error) {
      next(error);
    }
  },

  updateStatus: async (req, res, next) => {
    try {
      const { tenantId, connectionId } = req.params;
      const data = await propertyManagersService.updateStatus(
        tenantId,
        connectionId,
        req.body.status
      );
      res.ok(data, 'Status updated successfully');
    } catch (error) {
      next(error);
    }
  },

  delete: async (req, res, next) => {
    try {
      const { tenantId, connectionId } = req.params;
      const data = await propertyManagersService.delete(tenantId, connectionId);
      res.ok(data, 'Connection deleted successfully');
    } catch (error) {
      next(error);
    }
  },

  testConnection: async (req, res, next) => {
    try {
      const { tenantId, connectionId } = req.params;
      const data = await propertyManagersService.testConnection(tenantId, connectionId);
      res.ok(data, data.ok ? 'Connection successful' : 'Connection failed');
    } catch (error) {
      next(error);
    }
  },

  testCredentials: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const data = await propertyManagersService.testCredentials(tenantId, req.body);
      res.ok(data, data.ok ? 'Credentials are valid' : 'Credentials test failed');
    } catch (error) {
      next(error);
    }
  },

  triggerSync: async (req, res, next) => {
    try {
      const { tenantId, connectionId } = req.params;
      const steps = req.body?.steps;
      const stepsOpt = Array.isArray(steps) && steps.length > 0 ? steps : undefined;
      logger.info({ tenantId, connectionId, steps: stepsOpt }, 'Trigger sync: request received');
      const data = await propertyManagersService.triggerSync(tenantId, connectionId, {
        steps: stepsOpt,
      });
      res.ok(data, 'Sync requested');
    } catch (error) {
      next(error);
    }
  },

  listPmsDebtors: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const { connectionId, limit, offset, search, sortBy, sortOrder } = req.query;
      const result = await propertyManagersService.listPmsDebtors(tenantId, {
        connectionId: connectionId || undefined,
        limit,
        offset,
        search: search || undefined,
        sortBy: sortBy || undefined,
        sortOrder: sortOrder || undefined,
      });
      res.ok(result, 'PMS debtors retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  listPmsLeases: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const { connectionId, limit, offset, search, status, sortBy, sortOrder } = req.query;
      const result = await propertyManagersService.listPmsLeases(tenantId, {
        connectionId: connectionId || undefined,
        limit,
        offset,
        search: search || undefined,
        status: status || undefined,
        sortBy: sortBy || undefined,
        sortOrder: sortOrder || undefined,
      });
      res.ok(result, 'PMS leases retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  getPmsStats: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const data = await propertyManagersService.getPmsStats(tenantId);
      res.ok(data, 'PMS stats retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  listPmsCharges: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const { connectionId, limit, offset, sortBy, sortOrder } = req.query;
      const result = await propertyManagersService.listPmsCharges(tenantId, {
        connectionId: connectionId || undefined,
        limit,
        offset,
        sortBy: sortBy || undefined,
        sortOrder: sortOrder || undefined,
      });
      res.ok(result, 'PMS charges retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  listPmsPayments: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const { connectionId, limit, offset, sortBy, sortOrder } = req.query;
      const result = await propertyManagersService.listPmsPayments(tenantId, {
        connectionId: connectionId || undefined,
        limit,
        offset,
        sortBy: sortBy || undefined,
        sortOrder: sortOrder || undefined,
      });
      res.ok(result, 'PMS payments retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  getPmsBalancesSummary: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const data = await propertyManagersService.getPmsBalancesSummary(tenantId);
      res.ok(data, 'PMS balances summary retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  buildDebtCasesFromPms: async (req, res, next) => {
    try {
      const { tenantId, connectionId } = req.params;
      const result = await propertyManagersService.enqueueBuildCasesFromPms(tenantId, connectionId);
      res.ok(result, 'Build cases job enqueued. The worker will process it shortly.');
    } catch (error) {
      next(error);
    }
  },

  getBuildCasesJobStatus: async (req, res, next) => {
    try {
      const { tenantId, connectionId } = req.params;
      const jobId = String(req.query.jobId || '').trim();
      const status = await propertyManagersService.getBuildCasesJobStatus(tenantId, connectionId, jobId);
      if (!status) {
        return res.notFound('Job not found or does not belong to this connection');
      }
      res.ok(status, 'Build cases job status retrieved');
    } catch (error) {
      next(error);
    }
  },
};
