import { body, param } from 'express-validator';

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

export const triggerSyncValidator = [tenantIdParam, connectionIdParam];
