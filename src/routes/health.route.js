import { Router } from 'express';
import { sequelize } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import { requireAuth } from '../middlewares/index.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Health
 *   description: Endpoints de estado y monitoreo del servicio.
 */

// Health check básico
/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check básico
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Servicio OK
 */
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
/**
 * @swagger
 * /health/ready:
 *   get:
 *     summary: Readiness probe
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Servicio listo (DB conectada o deshabilitada)
 *       500:
 *         description: DB no disponible
 */
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
/**
 * @swagger
 * /health/live:
 *   get:
 *     summary: Liveness probe
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Servicio vivo
 */
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

// Health check secured with auth
/**
 * @swagger
 * /health/secure:
 *   get:
 *     summary: Health check autenticado
 *     tags: [Health]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Autenticado
 *       401:
 *         description: No autorizado
 */
router.get('/secure', requireAuth(), (req, res) => {
  return res.ok(
    {
      ok: true,
      user: {
        sub: req.user?.sub,
        username: req.user?.username,
        scope: req.user?.scope,
        client_id: req.user?.client_id,
      },
    },
    'Authenticated'
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