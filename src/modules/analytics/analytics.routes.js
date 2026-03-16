import { Router } from 'express';
import { analyticsController } from './analytics.controller.js';
import {
  portfolioSummaryValidator,
  agingByPortfolioValidator,
  agingTrendValidator,
  transitionMatrixValidator,
  topDebtorsValidator,
  recoveryValidator,
  riskByPortfolioValidator,
  riskByLeaseValidator,
} from './analytics.validator.js';
import { validateRequest } from '../../middlewares/validate-request.middleware.js';
import { requireAuth } from '../../middlewares/index.js';

const router = Router();

router.get(
  '/:tenantId/analytics/portfolio-summary',
  requireAuth(),
  portfolioSummaryValidator,
  validateRequest,
  analyticsController.getPortfolioSummary
);

router.get(
  '/:tenantId/analytics/aging-by-portfolio',
  requireAuth(),
  agingByPortfolioValidator,
  validateRequest,
  analyticsController.getAgingByPortfolio
);

router.get(
  '/:tenantId/analytics/aging-trend',
  requireAuth(),
  agingTrendValidator,
  validateRequest,
  analyticsController.getAgingTrend
);

router.get(
  '/:tenantId/analytics/transition-matrix',
  requireAuth(),
  transitionMatrixValidator,
  validateRequest,
  analyticsController.getTransitionMatrix
);

router.get(
  '/:tenantId/analytics/top-debtors',
  requireAuth(),
  topDebtorsValidator,
  validateRequest,
  analyticsController.getTopDebtors
);

router.get(
  '/:tenantId/analytics/recovery',
  requireAuth(),
  recoveryValidator,
  validateRequest,
  analyticsController.getRecovery
);

router.get(
  '/:tenantId/analytics/risk-by-portfolio',
  requireAuth(),
  riskByPortfolioValidator,
  validateRequest,
  analyticsController.getRiskByPortfolio
);

router.get(
  '/:tenantId/analytics/risk-by-lease',
  requireAuth(),
  riskByLeaseValidator,
  validateRequest,
  analyticsController.getRiskByLease
);

export default router;
