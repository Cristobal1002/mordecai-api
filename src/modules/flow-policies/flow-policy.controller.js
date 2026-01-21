import { flowPolicyService } from './flow-policy.service.js';

export const flowPolicyController = {
  listByTenant: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const result = await flowPolicyService.listByTenant(tenantId);
      res.ok(result, 'Flow policies retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  create: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const result = await flowPolicyService.create(tenantId, req.body);
      res.created(result, 'Flow policy created successfully');
    } catch (error) {
      next(error);
    }
  },
};
