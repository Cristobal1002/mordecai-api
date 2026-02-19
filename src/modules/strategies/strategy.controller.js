import { strategyService } from './strategy.service.js';

export const strategyController = {
  listByTenant: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const result = await strategyService.listByTenant(tenantId);
      res.ok(result, 'Strategies retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  getById: async (req, res, next) => {
    try {
      const { tenantId, id } = req.params;
      const result = await strategyService.getById(tenantId, id);
      res.ok(result, 'Strategy retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  create: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const result = await strategyService.create(tenantId, req.body);
      res.created(result, 'Strategy created successfully');
    } catch (error) {
      next(error);
    }
  },

  update: async (req, res, next) => {
    try {
      const { tenantId, id } = req.params;
      const result = await strategyService.update(tenantId, id, req.body);
      res.ok(result, 'Strategy updated successfully');
    } catch (error) {
      next(error);
    }
  },

  createStage: async (req, res, next) => {
    try {
      const { tenantId, strategyId } = req.params;
      const result = await strategyService.createStage(tenantId, strategyId, req.body);
      res.created(result, 'Stage created successfully');
    } catch (error) {
      next(error);
    }
  },

  updateStage: async (req, res, next) => {
    try {
      const { tenantId, strategyId, stageId } = req.params;
      const result = await strategyService.updateStage(tenantId, strategyId, stageId, req.body);
      res.ok(result, 'Stage updated successfully');
    } catch (error) {
      next(error);
    }
  },

  deleteStage: async (req, res, next) => {
    try {
      const { tenantId, strategyId, stageId } = req.params;
      const result = await strategyService.deleteStage(tenantId, strategyId, stageId);
      res.ok(result, 'Stage deactivated successfully');
    } catch (error) {
      next(error);
    }
  },
};
