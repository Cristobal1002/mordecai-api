import { param, body, query } from 'express-validator';

const idParam = param('id').isUUID().withMessage('Invalid ID');

export const listTypesValidator = [
  query('includeDisabled').optional().isBoolean().withMessage('includeDisabled must be boolean'),
];

export const getTypeValidator = [idParam];

export const createTypeValidator = [
  body('code').trim().notEmpty().withMessage('code is required').isLength({ max: 40 }),
  body('label').trim().notEmpty().withMessage('label is required').isLength({ max: 120 }),
  body('requiresReconciliation').optional().isBoolean(),
  body('sortOrder').optional().isInt({ min: 0 }),
  body('configSchema').optional().isObject().withMessage('configSchema must be an object'),
  body('configSchema.fields').optional().isArray().withMessage('configSchema.fields must be an array'),
  body('isEnabled').optional().isBoolean(),
];

export const updateTypeValidator = [
  idParam,
  body('code').optional().trim().notEmpty().isLength({ max: 40 }),
  body('label').optional().trim().notEmpty().isLength({ max: 120 }),
  body('requiresReconciliation').optional().isBoolean(),
  body('sortOrder').optional().isInt({ min: 0 }),
  body('configSchema').optional().isObject().withMessage('configSchema must be an object'),
  body('configSchema.fields').optional().isArray().withMessage('configSchema.fields must be an array'),
  body('isEnabled').optional().isBoolean(),
];

export const deleteTypeValidator = [idParam];
