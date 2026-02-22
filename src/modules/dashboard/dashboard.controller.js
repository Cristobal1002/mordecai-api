import { dashboardService } from './dashboard.service.js';

export const dashboardController = {
  getOverview: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const { range, connectionId } = req.query;
      const data = await dashboardService.getOverview(tenantId, {
        range: range || undefined,
        connectionId: connectionId || undefined,
      });
      res.ok(data, 'Dashboard overview retrieved successfully');
    } catch (error) {
      next(error);
    }
  },
};
