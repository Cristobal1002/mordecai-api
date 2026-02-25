import { tenantService } from './tenant.service.js';

export const tenantController = {
  create: async (req, res, next) => {
    try {
      const result = await tenantService.create(req.body, req);
      res.created(result, 'Tenant created successfully');
    } catch (error) {
      next(error);
    }
  },

  getAdminSnapshot: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const result = await tenantService.getAdminSnapshot(tenantId, req);
      res.ok(result, 'Admin snapshot retrieved');
    } catch (error) {
      next(error);
    }
  },

  update: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const result = await tenantService.update(tenantId, req.body, req);
      res.ok(result, 'Tenant updated');
    } catch (error) {
      next(error);
    }
  },
};
