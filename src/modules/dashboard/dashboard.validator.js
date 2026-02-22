import { param, query } from 'express-validator';

const tenantIdParam = param('tenantId').isUUID().withMessage('tenantId must be a valid UUID');

const RANGES = ['last_7_days', 'last_30_days', 'mtd'];

export const getOverviewValidator = [
  tenantIdParam,
  query('range').optional().isIn(RANGES).withMessage(`range must be one of: ${RANGES.join(', ')}`),
  query('connectionId').optional().isUUID().withMessage('connectionId must be a valid UUID'),
];
