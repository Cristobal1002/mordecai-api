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

  // JSON malformado en el body (body-parser / express.json())
  const status = err.status ?? err.statusCode;
  const isJsonParseError =
    err instanceof SyntaxError ||
    (status === 400 && (err.type === 'entity.parse.failed' || /JSON/i.test(String(err.message))));
  if (isJsonParseError) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON in request body',
      details: config.app.nodeEnv === 'development' ? { parseError: err.message } : undefined,
    });
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