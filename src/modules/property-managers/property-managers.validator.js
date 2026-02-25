import { body, param, query } from 'express-validator';

const connectionIdParam = param('connectionId')
  .isUUID()
  .withMessage('connectionId must be a valid UUID');
const tenantIdParam = param('tenantId').isUUID().withMessage('tenantId must be a valid UUID');

export const listPropertyManagersValidator = [tenantIdParam];

export const getPropertyManagerValidator = [tenantIdParam, connectionIdParam];

export const createPropertyManagerValidator = [
  tenantIdParam,
  body('softwareKey')
    .trim()
    .notEmpty()
    .withMessage('softwareKey is required')
    .isLength({ max: 64 })
    .withMessage('softwareKey must be up to 64 characters'),
  body('credentials').optional().isObject().withMessage('credentials must be an object'),
  body('status')
    .optional()
    .isIn(['draft', 'connected', 'syncing', 'error', 'disabled'])
    .withMessage('status must be draft, connected, syncing, error, or disabled'),
];

export const updateCredentialsValidator = [
  tenantIdParam,
  connectionIdParam,
  body('credentials').optional().isObject().withMessage('credentials must be an object'),
];

export const updateStatusValidator = [
  tenantIdParam,
  connectionIdParam,
  body('status')
    .isIn(['draft', 'connected', 'syncing', 'error', 'disabled'])
    .withMessage('status must be draft, connected, syncing, error, or disabled'),
];

export const testConnectionValidator = [tenantIdParam, connectionIdParam];

export const testCredentialsValidator = [
  tenantIdParam,
  body('softwareKey')
    .trim()
    .notEmpty()
    .withMessage('softwareKey is required')
    .isLength({ max: 64 })
    .withMessage('softwareKey must be up to 64 characters'),
  body('credentials').isObject().withMessage('credentials must be an object'),
];

const SYNC_STEPS = ['debtors_leases', 'charges', 'payments', 'balances_aging'];

export const triggerSyncValidator = [
  tenantIdParam,
  connectionIdParam,
  body('steps')
    .optional()
    .isArray()
    .withMessage('steps must be an array'),
  body('steps.*')
    .optional()
    .isIn(SYNC_STEPS)
    .withMessage(`each step must be one of: ${SYNC_STEPS.join(', ')}`),
];

const SORT_FIELDS = ['displayName', 'email', 'createdAt'];
const SORT_ORDERS = ['asc', 'desc'];

export const listPmsDebtorsValidator = [
  tenantIdParam,
  query('connectionId').optional().isUUID().withMessage('connectionId must be a valid UUID'),
  query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('limit must be between 1 and 1000'),
  query('offset').optional().isInt({ min: 0 }).withMessage('offset must be a non-negative integer'),
  query('search').optional().isString().trim().isLength({ max: 200 }).withMessage('search must be at most 200 characters'),
  query('sortBy').optional().isIn(SORT_FIELDS).withMessage(`sortBy must be one of: ${SORT_FIELDS.join(', ')}`),
  query('sortOrder').optional().isIn(SORT_ORDERS).withMessage('sortOrder must be asc or desc'),
];

const LEASE_SORT_FIELDS = ['leaseNumber', 'status', 'moveInDate', 'createdAt'];
const LEASE_STATUS_FILTERS = ['active', 'ended', 'pending'];

export const listPmsLeasesValidator = [
  tenantIdParam,
  query('connectionId').optional().isUUID().withMessage('connectionId must be a valid UUID'),
  query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('limit must be between 1 and 1000'),
  query('offset').optional().isInt({ min: 0 }).withMessage('offset must be a non-negative integer'),
  query('search').optional().isString().trim().isLength({ max: 200 }).withMessage('search must be at most 200 characters'),
  query('status').optional().isIn(LEASE_STATUS_FILTERS).withMessage(`status must be one of: ${LEASE_STATUS_FILTERS.join(', ')}`),
  query('sortBy').optional().isIn(LEASE_SORT_FIELDS).withMessage(`sortBy must be one of: ${LEASE_SORT_FIELDS.join(', ')}`),
  query('sortOrder').optional().isIn(SORT_ORDERS).withMessage('sortOrder must be asc or desc'),
];

export const getPmsStatsValidator = [tenantIdParam];

const CHARGE_SORT_FIELDS = ['dueDate', 'postDate', 'amountCents', 'createdAt'];
export const listPmsChargesValidator = [
  tenantIdParam,
  query('connectionId').optional().isUUID().withMessage('connectionId must be a valid UUID'),
  query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('limit must be between 1 and 500'),
  query('offset').optional().isInt({ min: 0 }).withMessage('offset must be a non-negative integer'),
  query('sortBy').optional().isIn(CHARGE_SORT_FIELDS).withMessage(`sortBy must be one of: ${CHARGE_SORT_FIELDS.join(', ')}`),
  query('sortOrder').optional().isIn(SORT_ORDERS).withMessage('sortOrder must be asc or desc'),
];

const PAYMENT_SORT_FIELDS = ['paidAt', 'amountCents', 'createdAt'];
export const listPmsPaymentsValidator = [
  tenantIdParam,
  query('connectionId').optional().isUUID().withMessage('connectionId must be a valid UUID'),
  query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('limit must be between 1 and 500'),
  query('offset').optional().isInt({ min: 0 }).withMessage('offset must be a non-negative integer'),
  query('sortBy').optional().isIn(PAYMENT_SORT_FIELDS).withMessage(`sortBy must be one of: ${PAYMENT_SORT_FIELDS.join(', ')}`),
  query('sortOrder').optional().isIn(SORT_ORDERS).withMessage('sortOrder must be asc or desc'),
];

export const getPmsBalancesSummaryValidator = [tenantIdParam];

export const getBuildCasesStatusValidator = [
  tenantIdParam,
  connectionIdParam,
  query('jobId').notEmpty().withMessage('jobId is required').isString().trim(),
];
