import { body, param, query } from 'express-validator';

const tenantIdParam = param('tenantId').isUUID().withMessage('Invalid tenant ID format (UUID required)');
const automationIdParam = param('automationId').isUUID().withMessage('Invalid automation ID format (UUID required)');

export const listAutomationsValidator = [
  tenantIdParam,
  query('pmsConnectionId').optional().isUUID().withMessage('pmsConnectionId must be a valid UUID'),
];

export const getAutomationValidator = [tenantIdParam, automationIdParam];

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

export const getCasesValidator = [
  tenantIdParam,
  automationIdParam,
  query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('limit must be between 1 and 200'),
  query('offset').optional().isInt({ min: 0 }).withMessage('offset must be non-negative'),
];

export const getActivityValidator = [
  tenantIdParam,
  automationIdParam,
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
];

export const enrollAutomationValidator = [
  tenantIdParam,
  automationIdParam,
  body('debtCaseIds').optional().isArray().withMessage('debtCaseIds must be an array'),
  body('debtCaseIds.*').optional().isUUID().withMessage('each debtCaseId must be a valid UUID'),
];

export const recomputeStagesValidator = [tenantIdParam, automationIdParam];
