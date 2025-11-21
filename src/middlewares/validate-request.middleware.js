import { validationResult } from 'express-validator';
import { RequestValidationError } from '../errors/index.js';
import { logger } from '../utils/logger.js';

export const validateRequest = (req, _, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors
      .array()
      .map((e) => {
        if (e.nestedErrors) {
          return e.nestedErrors.map((nestedError) => ({
            msg: nestedError.msg,
            param: nestedError.param,
            location: nestedError.location,
            value: nestedError.value,
          }));
        } else {
          return {
            msg: e.msg,
            param: e.param,
            location: e.location,
            value: e.value,
          };
        }
      })
      .flat();

    logger.warn(
      {
        errors: formattedErrors,
        path: req.path,
        method: req.method,
      },
      'Validation errors detected'
    );

    return next(new RequestValidationError(formattedErrors));
  }

  next();
};