import { body, param, query } from 'express-validator';

export const createSoftwareValidator = [
  body('key')
    .trim()
    .notEmpty()
    .withMessage('key is required')
    .isLength({ min: 1, max: 64 })
    .withMessage('key must be 1-64 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('key must be alphanumeric, underscore or hyphen (stored as lowercase)'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('name is required')
    .isLength({ max: 120 })
    .withMessage('name must be up to 120 characters'),
  body('category')
    .trim()
    .notEmpty()
    .withMessage('category is required')
    .isLength({ max: 64 })
    .withMessage('category must be up to 64 characters'),
  body('authType')
    .trim()
    .notEmpty()
    .withMessage('authType is required')
    .isIn(['oauth2', 'apiKey'])
    .withMessage('authType must be oauth2 or apiKey'),
  body('authConfig').optional().isObject().withMessage('authConfig must be an object'),
  body('capabilities').optional().isObject().withMessage('capabilities must be an object'),
  body('logoUrl')
    .optional({ checkFalsy: true })
    .isString()
    .isURL()
    .withMessage('logoUrl must be a valid URL'),
  body('docsUrl')
    .optional({ checkFalsy: true })
    .isString()
    .isURL()
    .withMessage('docsUrl must be a valid URL'),
  body('isEnabled').optional().isBoolean().withMessage('isEnabled must be a boolean'),
];

export const listSoftwaresValidator = [
  query('category')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 64 })
    .withMessage('category must be a string up to 64 characters'),
];

export const getSetupStepsValidator = [
  param('softwareKey')
    .trim()
    .notEmpty()
    .withMessage('softwareKey is required')
    .isLength({ max: 64 })
    .withMessage('softwareKey must be up to 64 characters'),
];
