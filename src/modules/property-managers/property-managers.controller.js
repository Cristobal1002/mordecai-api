import { propertyManagersService } from './property-managers.service.js';

/** Remove credentials from connection payload so they are never sent to the client. */
function sanitizeConnection(connection) {
  const plain = connection?.get ? connection.get({ plain: true }) : connection;
  if (!plain) return plain;
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
      const data = await propertyManagersService.triggerSync(tenantId, connectionId);
      res.ok(data, 'Sync requested');
    } catch (error) {
      next(error);
    }
  },
};
