import { body, param, query } from 'express-validator';

const tenantIdParam = param('tenantId').isUUID().withMessage('Invalid tenant ID format (UUID required)');
const caseIdParam = param('caseId').isUUID().withMessage('Invalid case ID format (UUID required)');

export const getCaseValidator = [tenantIdParam, caseIdParam];

export const getTimelineValidator = [
  tenantIdParam,
  caseIdParam,
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
];

export const pauseCaseValidator = [
  tenantIdParam,
  caseIdParam,
  body('automationId').optional().isUUID().withMessage('automationId must be a valid UUID'),
];

export const resumeCaseValidator = [
  tenantIdParam,
  caseIdParam,
  body('automationId').optional().isUUID().withMessage('automationId must be a valid UUID'),
];
