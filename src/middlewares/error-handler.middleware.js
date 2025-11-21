import { CustomError } from '../errors/index.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

export const errorHandler = (err, req, res, _next) => {
  // Log del error
  logger.error(
    {
      error: {
        name: err.name,
        message: err.message,
        stack: err.stack,
      },
      request: {
        method: req.method,
        url: req.url,
        ip: req.ip,
        body: req.body,
      },
    },
    'Error capturado'
  );

  if (err instanceof CustomError) {
    const serialized = err.serialize();
    return res.status(err.statusCode).json(serialized);
  }

  // Error no manejado
  return res.status(500).json({
    type: 'about:blank',
    title: 'Internal server error',
    status: 500,
    details: {
      message:
        config.app.nodeEnv === 'development'
          ? err.message
          : 'An internal server error occurred',
      ...(config.app.nodeEnv === 'development' && { stack: err.stack }),
    },
  });
};