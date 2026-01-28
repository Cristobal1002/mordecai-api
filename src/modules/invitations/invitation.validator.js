import { param } from 'express-validator';

export const acceptInvitationValidator = [
  param('token')
    .isString()
    .isLength({ min: 10 })
    .withMessage('token is required'),
];
