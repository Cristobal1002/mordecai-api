import { param, query } from 'express-validator';

const tenantIdParam = param('tenantId').isUUID().withMessage('tenantId must be a valid UUID');

export const portfolioSummaryValidator = [
  tenantIdParam,
  query('connectionId').optional().isUUID().withMessage('connectionId must be a valid UUID'),
];

export const agingByPortfolioValidator = [
  tenantIdParam,
  query('connectionId').optional().isUUID().withMessage('connectionId must be a valid UUID'),
  query('asOfDate').optional().isDate().withMessage('asOfDate must be a valid date (YYYY-MM-DD)'),
];

export const agingTrendValidator = [
  tenantIdParam,
  query('connectionId').optional().isUUID().withMessage('connectionId must be a valid UUID'),
  query('days').optional().isInt({ min: 1, max: 365 }).withMessage('days must be between 1 and 365'),
];

export const transitionMatrixValidator = [
  tenantIdParam,
  query('connectionId').optional().isUUID().withMessage('connectionId must be a valid UUID'),
  query('fromDate').optional().isDate().withMessage('fromDate must be a valid date'),
  query('toDate').optional().isDate().withMessage('toDate must be a valid date'),
];

export const topDebtorsValidator = [
  tenantIdParam,
  query('connectionId').optional().isUUID().withMessage('connectionId must be a valid UUID'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
  query('sortBy').optional().isIn(['vencido', 'total', 'daysOverdue']).withMessage('sortBy must be vencido, total, or daysOverdue'),
];

export const recoveryValidator = [
  tenantIdParam,
  query('connectionId').optional().isUUID().withMessage('connectionId must be a valid UUID'),
  query('days').optional().isInt({ min: 1, max: 365 }).withMessage('days must be between 1 and 365'),
  query('groupBy').optional().isIn(['portfolio', 'property']).withMessage('groupBy must be portfolio or property'),
];

export const riskByPortfolioValidator = [
  tenantIdParam,
  query('connectionId').optional().isUUID().withMessage('connectionId must be a valid UUID'),
];

export const riskByLeaseValidator = [
  tenantIdParam,
  query('connectionId').optional().isUUID().withMessage('connectionId must be a valid UUID'),
  query('portfolioId').optional().isUUID().withMessage('portfolioId must be a valid UUID'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
  query('sortBy').optional().isIn(['risk', 'balance']).withMessage('sortBy must be risk or balance'),
];
