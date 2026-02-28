import { param } from 'express-validator';

export const tokenParamValidator = [
  param('token')
    .isString()
    .isLength({ min: 10 })
    .withMessage('token is required'),
];

export const acceptInvitationValidator = tokenParamValidator;
