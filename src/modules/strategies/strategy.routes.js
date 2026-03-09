import { Router } from 'express';
import { strategyController } from './strategy.controller.js';
import {
  listStrategiesValidator,
  getStrategyValidator,
  createStrategyValidator,
  updateStrategyValidator,
  createStageValidator,
  updateStageValidator,
  deleteStageValidator,
  getDeletabilityValidator,
  deleteStrategyValidator,
} from './strategy.validator.js';
import { validateRequest } from '../../middlewares/validate-request.middleware.js';

const router = Router();

// GET /api/v1/tenants/:tenantId/strategies
router.get('/:tenantId/strategies', listStrategiesValidator, validateRequest, strategyController.listByTenant);

// POST /api/v1/tenants/:tenantId/strategies
router.post('/:tenantId/strategies', createStrategyValidator, validateRequest, strategyController.create);

// GET /api/v1/tenants/:tenantId/strategies/:id
router.get('/:tenantId/strategies/:id', getStrategyValidator, validateRequest, strategyController.getById);

// PUT /api/v1/tenants/:tenantId/strategies/:id
router.put('/:tenantId/strategies/:id', updateStrategyValidator, validateRequest, strategyController.update);

// POST /api/v1/tenants/:tenantId/strategies/:strategyId/stages
router.post(
  '/:tenantId/strategies/:strategyId/stages',
  createStageValidator,
  validateRequest,
  strategyController.createStage
);

// PUT /api/v1/tenants/:tenantId/strategies/:strategyId/stages/:stageId
router.put(
  '/:tenantId/strategies/:strategyId/stages/:stageId',
  updateStageValidator,
  validateRequest,
  strategyController.updateStage
);

// DELETE /api/v1/tenants/:tenantId/strategies/:strategyId/stages/:stageId
router.delete(
  '/:tenantId/strategies/:strategyId/stages/:stageId',
  deleteStageValidator,
  validateRequest,
  strategyController.deleteStage
);

// GET /api/v1/tenants/:tenantId/strategies/:id/deletability
router.get(
  '/:tenantId/strategies/:id/deletability',
  getDeletabilityValidator,
  validateRequest,
  strategyController.getDeletability
);

// DELETE /api/v1/tenants/:tenantId/strategies/:id
router.delete(
  '/:tenantId/strategies/:id',
  deleteStrategyValidator,
  validateRequest,
  strategyController.delete
);

export default router;
