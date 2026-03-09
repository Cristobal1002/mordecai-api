import { body, param } from 'express-validator';

const tenantIdParam = param('tenantId').isUUID().withMessage('Invalid tenant ID format (UUID required)');
const strategyIdParam = param('strategyId').isUUID().withMessage('Invalid strategy ID format (UUID required)');
const stageIdParam = param('stageId').isUUID().withMessage('Invalid stage ID format (UUID required)');

export const listStrategiesValidator = [tenantIdParam];

export const getStrategyValidator = [tenantIdParam, param('id').isUUID().withMessage('Invalid strategy ID')];

export const createStrategyValidator = [
  tenantIdParam,
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ min: 1, max: 120 }).withMessage('Name must be at most 120 characters'),
  body('description').optional().trim().isLength({ max: 2000 }).withMessage('Description must be at most 2000 characters'),
  body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
  body('globalRules').optional().isObject().withMessage('globalRules must be an object'),
  body('maxAttemptsPerWeek').optional({ nullable: true }).isInt({ min: 1 }).withMessage('maxAttemptsPerWeek must be a positive integer'),
  body('cooldownHours').optional({ nullable: true }).isInt({ min: 0 }).withMessage('cooldownHours must be a non-negative integer'),
  body('allowedTimeWindow').optional({ nullable: true }).trim().isLength({ max: 64 }).withMessage('allowedTimeWindow must be at most 64 characters'),
  body('stopOnPromise').optional().isBoolean().withMessage('stopOnPromise must be boolean'),
  body('stopOnPayment').optional().isBoolean().withMessage('stopOnPayment must be boolean'),
];

export const updateStrategyValidator = [
  tenantIdParam,
  param('id').isUUID().withMessage('Invalid strategy ID'),
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty').isLength({ max: 120 }).withMessage('Name must be at most 120 characters'),
  body('description').optional().trim().isLength({ max: 2000 }).withMessage('Description must be at most 2000 characters'),
  body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
  body('globalRules').optional().isObject().withMessage('globalRules must be an object'),
  body('maxAttemptsPerWeek').optional({ nullable: true }).isInt({ min: 1 }).withMessage('maxAttemptsPerWeek must be a positive integer'),
  body('cooldownHours').optional({ nullable: true }).isInt({ min: 0 }).withMessage('cooldownHours must be a non-negative integer'),
  body('allowedTimeWindow').optional({ nullable: true }).trim().isLength({ max: 64 }).withMessage('allowedTimeWindow must be at most 64 characters'),
  body('stopOnPromise').optional().isBoolean().withMessage('stopOnPromise must be boolean'),
  body('stopOnPayment').optional().isBoolean().withMessage('stopOnPayment must be boolean'),
];

export const createStageValidator = [
  tenantIdParam,
  strategyIdParam,
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 120 }).withMessage('Name must be at most 120 characters'),
  body('minDaysPastDue').isInt({ min: -365 }).withMessage('minDaysPastDue must be an integer >= -365 (negative = days before due)'),
  body('maxDaysPastDue')
    .optional({ nullable: true })
    .custom((value, { req }) => {
      if (value === null || value === undefined) return true;
      const maxVal = Number(value);
      if (!Number.isInteger(maxVal) || maxVal < -365) throw new Error('maxDaysPastDue must be an integer >= -365 or null');
      const minVal = Number(req.body.minDaysPastDue);
      if (minVal != null && maxVal < minVal) throw new Error('maxDaysPastDue must be >= minDaysPastDue');
      return true;
    }),
  body('channels').optional().isObject().withMessage('channels must be an object'),
  body('messagingConfig').optional().isObject().withMessage('messagingConfig must be an object'),
  body('tone').optional().isIn(['friendly', 'professional', 'firm']).withMessage('tone must be friendly, professional, or firm'),
  body('rules').optional().isObject().withMessage('rules must be an object'),
];

export const updateStageValidator = [
  tenantIdParam,
  strategyIdParam,
  stageIdParam,
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty').isLength({ max: 120 }).withMessage('Name must be at most 120 characters'),
  body('minDaysPastDue').optional().isInt({ min: -365 }).withMessage('minDaysPastDue must be an integer >= -365'),
  body('maxDaysPastDue')
    .optional({ nullable: true })
    .custom((value, { req }) => {
      if (value === null || value === undefined) return true;
      const maxVal = Number(value);
      if (!Number.isInteger(maxVal) || maxVal < -365) throw new Error('maxDaysPastDue must be an integer >= -365 or null');
      const minVal = req.body.minDaysPastDue != null ? Number(req.body.minDaysPastDue) : null;
      if (minVal != null && maxVal < minVal) throw new Error('maxDaysPastDue must be >= minDaysPastDue');
      return true;
    }),
  body('channels').optional().isObject().withMessage('channels must be an object'),
  body('messagingConfig').optional().isObject().withMessage('messagingConfig must be an object'),
  body('tone').optional().isIn(['friendly', 'professional', 'firm']).withMessage('tone must be friendly, professional, or firm'),
  body('rules').optional().isObject().withMessage('rules must be an object'),
  body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
];

export const deleteStageValidator = [tenantIdParam, strategyIdParam, stageIdParam];

export const deleteStrategyValidator = [tenantIdParam, param('id').isUUID().withMessage('Invalid strategy ID')];

export const getDeletabilityValidator = [tenantIdParam, param('id').isUUID().withMessage('Invalid strategy ID')];
