import { propertyManagersService } from './property-managers.service.js';

export const propertyManagersController = {
  listByTenant: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const data = await propertyManagersService.listByTenant(tenantId);
      res.ok(data, 'PMS connections retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  getById: async (req, res, next) => {
    try {
      const { tenantId, connectionId } = req.params;
      const data = await propertyManagersService.getById(tenantId, connectionId);
      res.ok(data, 'PMS connection retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  create: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const data = await propertyManagersService.create(tenantId, req.body);
      res.created(data, 'PMS connection created successfully');
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
      res.ok(data, 'Credentials updated successfully');
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

  testConnection: async (req, res, next) => {
    try {
      const { tenantId, connectionId } = req.params;
      const data = await propertyManagersService.testConnection(tenantId, connectionId);
      res.ok(data, data.ok ? 'Connection successful' : 'Connection failed');
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
