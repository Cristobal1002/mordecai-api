import express from 'express';
import { sequelize } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

export const health = express.Router();

// Health check básico
health.get('/', async (req, res) => {
  res.ok({ status: 'OK', timestamp: new Date().toISOString() });
});

// Readiness probe (verifica DB)
health.get('/ready', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.ok({
      status: 'ready',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error }, 'Health check failed');
    res.status(503).json({
      success: false,
      status: 'not ready',
      database: 'disconnected',
      timestamp: new Date().toISOString(),
    });
  }
});

// Liveness probe
health.get('/live', async (req, res) => {
  res.ok({
    status: 'alive',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Endpoints de prueba de errores (solo en desarrollo)
if (config.app.nodeEnv === 'development') {
  health.get('/not-found', async () => {
    const { NotFoundError } = await import('../errors/index.js');
    throw new NotFoundError('Property');
  });

  health.get('/forbidden', async () => {
    const { ForbiddenError } = await import('../errors/index.js');
    throw new ForbiddenError('Access denied to resource');
  });

  health.get('/integration', async () => {
    const { IntegrationError } = await import('../errors/index.js');
    throw new IntegrationError('Shopify', { credentials: 'Invalid credentials' });
  });

  health.get('/boom', async () => {
    throw new Error('Internal explosion');
  });
}