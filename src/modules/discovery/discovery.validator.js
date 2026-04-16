import { param, body } from 'express-validator';

const clientSessionIdParam = param('clientSessionId').isUUID().withMessage('Invalid clientSessionId');

export const getSessionValidator = [clientSessionIdParam];

export const upsertSessionValidator = [
  clientSessionIdParam,
  body('answers').isObject().withMessage('answers must be an object'),
  body('currentStepIndex').isInt({ min: -1, max: 500 }).withMessage('currentStepIndex must be an integer'),
  body('completed').optional().isBoolean(),
];
