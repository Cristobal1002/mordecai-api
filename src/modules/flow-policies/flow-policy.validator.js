import { body, param } from 'express-validator';

export const createFlowPolicyValidator = [
  param('tenantId')
    .isUUID()
    .withMessage('Invalid tenant ID format (UUID required)'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 3, max: 120 })
    .withMessage('Name must be between 3 and 120 characters'),
  body('minDaysPastDue')
    .isInt({ min: 0 })
    .withMessage('minDaysPastDue must be a non-negative integer'),
  body('maxDaysPastDue')
    .optional({ nullable: true })
    .custom((value, { req }) => {
      if (value === null || value === undefined) {
        return true;
      }
      const maxValue = Number(value);
      if (!Number.isInteger(maxValue) || maxValue < 0) {
        throw new Error('maxDaysPastDue must be a non-negative integer or null');
      }
      const minValue = Number(req.body.minDaysPastDue);
      if (Number.isInteger(minValue) && maxValue < minValue) {
        throw new Error('maxDaysPastDue must be greater than or equal to minDaysPastDue');
      }
      return true;
    }),
  body('channels')
    .optional()
    .isObject()
    .withMessage('channels must be an object'),
  body('channels.sms')
    .optional()
    .isBoolean()
    .withMessage('channels.sms must be boolean'),
  body('channels.email')
    .optional()
    .isBoolean()
    .withMessage('channels.email must be boolean'),
  body('channels.call')
    .optional()
    .isBoolean()
    .withMessage('channels.call must be boolean'),
  body('channels.whatsapp')
    .optional()
    .isBoolean()
    .withMessage('channels.whatsapp must be boolean'),
  body('tone')
    .optional()
    .isIn(['friendly', 'professional', 'firm'])
    .withMessage('tone must be friendly, professional, or firm'),
  body('rules')
    .optional()
    .isObject()
    .withMessage('rules must be an object'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be boolean'),
];

export const listFlowPoliciesValidator = [
  param('tenantId')
    .isUUID()
    .withMessage('Invalid tenant ID format (UUID required)'),
];
