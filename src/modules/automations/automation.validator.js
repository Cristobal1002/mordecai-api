import { body, param, query } from 'express-validator';

const tenantIdParam = param('tenantId').isUUID().withMessage('Invalid tenant ID format (UUID required)');
const automationIdParam = param('automationId').isUUID().withMessage('Invalid automation ID format (UUID required)');

export const listAutomationsValidator = [
  tenantIdParam,
  query('pmsConnectionId').optional().isUUID().withMessage('pmsConnectionId must be a valid UUID'),
];

export const getAutomationValidator = [tenantIdParam, automationIdParam];

export const updateAutomationValidator = [
  tenantIdParam,
  automationIdParam,
  body('approvalMode').optional().isIn(['AUTO', 'REQUIRE_APPROVAL', 'HYBRID']),
  body('approvalRules').optional().isObject(),
];

export const createAutomationValidator = [
  tenantIdParam,
  body('pmsConnectionId').isUUID().withMessage('pmsConnectionId is required and must be a valid UUID'),
  body('strategyId').isUUID().withMessage('strategyId is required and must be a valid UUID'),
];

export const activateAutomationValidator = [tenantIdParam, automationIdParam];
export const pauseAutomationValidator = [tenantIdParam, automationIdParam];
export const stopAutomationValidator = [tenantIdParam, automationIdParam];
export const deleteAutomationValidator = [tenantIdParam, automationIdParam];

export const getSummaryValidator = [tenantIdParam, automationIdParam];
export const getOverviewValidator = [tenantIdParam, automationIdParam];

export const getCasesValidator = [
  tenantIdParam,
  automationIdParam,
  query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('limit must be between 1 and 200'),
  query('offset').optional().isInt({ min: 0 }).withMessage('offset must be non-negative'),
  query('tab').optional().isIn(['pending', 'active', 'excluded', 'disputes']).withMessage('tab must be pending, active, excluded, or disputes'),
  query('status').optional().isString().withMessage('status must be comma-separated: PENDING_APPROVAL,APPROVED,ACTIVE,EXCLUDED,IN_DISPUTE'),
  query('stage').optional().isString(),
  query('dpdMin').optional().isInt({ min: 0 }),
  query('dpdMax').optional().isInt({ min: 0 }),
  query('amountMinCents').optional().isInt({ min: 0 }),
  query('amountMaxCents').optional().isInt({ min: 0 }),
  query('sortBy').optional().isIn(['debtorName', 'amountDueCents', 'daysPastDue', 'approvalStatus']).withMessage('sortBy must be debtorName, amountDueCents, daysPastDue, or approvalStatus'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('sortOrder must be asc or desc'),
  query('search').optional().isString().withMessage('search must be a string'),
];

export const bulkCasesValidator = [
  tenantIdParam,
  automationIdParam,
  body('caseIds').isArray().withMessage('caseIds must be an array'),
  body('caseIds.*').isUUID().withMessage('each caseId must be a valid UUID'),
];

export const getActivityValidator = [
  tenantIdParam,
  automationIdParam,
  query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('limit must be between 1 and 200'),
  query('dateFrom').optional().isISO8601().withMessage('dateFrom must be ISO8601 date'),
  query('dateTo').optional().isISO8601().withMessage('dateTo must be ISO8601 date'),
  query('search').optional().isString(),
  query('groupBy').optional().isIn(['day', 'case']).withMessage('groupBy must be day or case'),
  query('channels').optional().isString(),
  query('statuses').optional().isString(),
  query('outcomes').optional().isString(),
  query('stages').optional().isString(),
];

export const enrollAutomationValidator = [
  tenantIdParam,
  automationIdParam,
  body('debtCaseIds').optional().isArray().withMessage('debtCaseIds must be an array'),
  body('debtCaseIds.*').optional().isUUID().withMessage('each debtCaseId must be a valid UUID'),
];

export const recomputeStagesValidator = [tenantIdParam, automationIdParam];

const debtCaseIdParam = param('debtCaseId').isUUID().withMessage('Invalid debt case ID format (UUID required)');

export const runStrategyForCaseValidator = [tenantIdParam, automationIdParam, debtCaseIdParam];

export const bulkByFiltersValidator = [
  tenantIdParam,
  automationIdParam,
  body('action').isIn(['approve', 'exclude']).withMessage('action must be approve or exclude'),
  body('filters').optional().isObject().withMessage('filters must be an object'),
  body('filters.status').optional().isArray(),
  body('filters.status.*').optional().isString(),
  body('filters.stage').optional().isArray(),
  body('filters.stage.*').optional().isString(),
  body('filters.dpdMin').optional().isInt({ min: 0 }),
  body('filters.dpdMax').optional().isInt({ min: 0 }),
  body('filters.amountMinCents').optional().isInt({ min: 0 }),
  body('filters.amountMaxCents').optional().isInt({ min: 0 }),
  body('reason').optional().isString(),
];
