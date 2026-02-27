import { param, body, query } from 'express-validator';

const tenantIdParam = param('tenantId').isUUID().withMessage('Invalid tenant ID');
const channelIdParam = param('channelId').isUUID().withMessage('Invalid channel ID');

export const listChannelsValidator = [
  tenantIdParam,
  query('includeInactive').optional().isBoolean().withMessage('includeInactive must be boolean'),
];

export const getChannelValidator = [tenantIdParam, channelIdParam];

export const createChannelValidator = [
  tenantIdParam,
  body('code').trim().notEmpty().withMessage('code is required').isLength({ max: 40 }),
  body('label').trim().notEmpty().withMessage('label is required').isLength({ max: 120 }),
  body('requiresReconciliation').optional().isBoolean(),
  body('instructionsTemplate').optional().trim(),
  body('config').optional().isObject().withMessage('config must be an object'),
  body('sortOrder').optional().isInt({ min: 0 }),
  body('isActive').optional().isBoolean(),
];

export const updateChannelValidator = [
  tenantIdParam,
  channelIdParam,
  body('code').optional().trim().notEmpty().isLength({ max: 40 }),
  body('label').optional().trim().notEmpty().isLength({ max: 120 }),
  body('requiresReconciliation').optional().isBoolean(),
  body('instructionsTemplate').optional().trim(),
  body('config').optional().isObject().withMessage('config must be an object'),
  body('sortOrder').optional().isInt({ min: 0 }),
  body('isActive').optional().isBoolean(),
];

export const deleteChannelValidator = [tenantIdParam, channelIdParam];

export const seedDefaultsValidator = [tenantIdParam];
