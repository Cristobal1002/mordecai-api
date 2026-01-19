import { Router } from 'express';
import { sequelize } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

const router = Router();

// Health check básico
router.get('/', (req, res) => {
  return res.ok(
    {
      status: 'OK',
      timestamp: new Date().toISOString(),
    },
    'Service is healthy'
  );
});

// Readiness probe (verifica DB)
router.get('/ready', async (req, res) => {
  try {
    if (config.db.enabled) {
      await sequelize.authenticate();
      return res.ok(
        {
          status: 'READY',
          database: 'connected',
          timestamp: new Date().toISOString(),
        },
        'Service is ready'
      );
    } else {
      return res.ok(
        {
          status: 'READY',
          database: 'disabled',
          timestamp: new Date().toISOString(),
        },
        'Service is ready (database disabled)'
      );
    }
  } catch (error) {
    logger.error({ error }, 'Database readiness check failed');
    return res.serverError(
      {
        status: 'NOT_READY',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      },
      'Service is not ready'
    );
  }
});

// Liveness probe
router.get('/live', (req, res) => {
  return res.ok(
    {
      status: 'LIVE',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
    'Service is alive'
  );
});

// Endpoints de prueba de errores (solo en desarrollo)
if (config.app.nodeEnv === 'development') {
  router.get('/not-found', async () => {
    const { NotFoundError } = await import('../errors/index.js');
    throw new NotFoundError('Property');
  });

  router.get('/forbidden', async () => {
    const { ForbiddenError } = await import('../errors/index.js');
    throw new ForbiddenError('Access denied to resource');
  });

  router.get('/integration', async () => {
    const { IntegrationError } = await import('../errors/index.js');
    throw new IntegrationError('Shopify', { credentials: 'Invalid credentials' });
  });

  router.get('/boom', async () => {
    throw new Error('Internal explosion');
  });
}

export default router;