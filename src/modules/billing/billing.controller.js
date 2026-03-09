import { billingService } from './billing.service.js';
import { tenantService } from '../tenants/tenant.service.js';

export const billingController = {
  getUsage: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      await tenantService.requireTenantAdmin(tenantId, req);
      const data = await billingService.getUsageSummary(tenantId);
      res.ok(data, 'Billing usage retrieved');
    } catch (error) {
      next(error);
    }
  },

  updateSubscription: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      await tenantService.requireTenantOwner(tenantId, req);
      const data = await billingService.updateSubscription(tenantId, req.body);
      res.ok(data, 'Subscription updated');
    } catch (error) {
      next(error);
    }
  },
};
