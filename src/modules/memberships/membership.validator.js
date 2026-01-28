import { body, param } from 'express-validator';

export const tenantIdParam = [
  param('tenantId').isUUID().withMessage('Invalid tenantId'),
];

export const memberIdParam = [
  ...tenantIdParam,
  param('userId').isUUID().withMessage('Invalid userId'),
];

export const inviteMemberValidator = [
  ...tenantIdParam,
  body('email').isEmail().withMessage('Valid email is required'),
  body('role')
    .optional()
    .isIn(['admin', 'member'])
    .withMessage('role must be admin or member'),
];

export const updateMemberValidator = [
  ...memberIdParam,
  body('role')
    .optional()
    .isIn(['admin', 'member'])
    .withMessage('role must be admin or member'),
  body('status')
    .optional()
    .isIn(['active', 'disabled'])
    .withMessage('status must be active or disabled'),
];

export const deleteMemberValidator = [...memberIdParam];
