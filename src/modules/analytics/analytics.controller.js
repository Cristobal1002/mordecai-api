import { analyticsService } from './analytics.service.js';

export const analyticsController = {
  getPortfolioSummary: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const { connectionId, portfolioId } = req.query;
      const data = await analyticsService.getPortfolioSummary(tenantId, { connectionId, portfolioId });
      res.ok(data, 'Portfolio summary retrieved');
    } catch (error) {
      next(error);
    }
  },

  getAgingByPortfolio: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const { connectionId, portfolioId, asOfDate } = req.query;
      const data = await analyticsService.getAgingByPortfolio(tenantId, { connectionId, portfolioId, asOfDate });
      res.ok(data, 'Aging by portfolio retrieved');
    } catch (error) {
      next(error);
    }
  },

  getAgingTrend: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const { connectionId, days } = req.query;
      const data = await analyticsService.getAgingTrend(tenantId, { connectionId, days });
      res.ok(data, 'Aging trend retrieved');
    } catch (error) {
      next(error);
    }
  },

  getTransitionMatrix: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const { connectionId, fromDate, toDate } = req.query;
      const data = await analyticsService.getTransitionMatrix(tenantId, {
        connectionId,
        fromDate,
        toDate,
      });
      res.ok(data, 'Transition matrix retrieved');
    } catch (error) {
      next(error);
    }
  },

  getTopDebtors: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const { connectionId, limit, sortBy } = req.query;
      const data = await analyticsService.getTopDebtors(tenantId, {
        connectionId,
        limit,
        sortBy,
      });
      res.ok(data, 'Top debtors retrieved');
    } catch (error) {
      next(error);
    }
  },

  getRecovery: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const { connectionId, days, groupBy } = req.query;
      const data = await analyticsService.getRecovery(tenantId, {
        connectionId,
        days,
        groupBy,
      });
      res.ok(data, 'Recovery retrieved');
    } catch (error) {
      next(error);
    }
  },

  getRiskByPortfolio: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const { connectionId } = req.query;
      const data = await analyticsService.getRiskByPortfolio(tenantId, { connectionId });
      res.ok(data, 'Risk by portfolio retrieved');
    } catch (error) {
      next(error);
    }
  },

  getRiskByLease: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const { connectionId, portfolioId, limit, sortBy } = req.query;
      const data = await analyticsService.getRiskByLease(tenantId, {
        connectionId,
        portfolioId,
        limit,
        sortBy,
      });
      res.ok(data, 'Risk by lease retrieved');
    } catch (error) {
      next(error);
    }
  },
};
