import { CollectionStrategy, CollectionStage } from '../../models/index.js';
import { logger } from '../../utils/logger.js';

export const strategyRepository = {
  findByTenant: async (tenantId, options = {}) => {
    try {
      return await CollectionStrategy.findAll({
        where: { tenantId },
        include: [{ model: CollectionStage, as: 'stages', where: { isActive: true }, required: false }],
        order: [['createdAt', 'DESC']],
        ...options,
      });
    } catch (error) {
      logger.error({ error, tenantId }, 'Error finding strategies');
      throw error;
    }
  },

  findById: async (id, tenantId, options = {}) => {
    try {
      return await CollectionStrategy.findOne({
        where: { id, tenantId },
        include: [{ model: CollectionStage, as: 'stages' }],
        ...options,
      });
    } catch (error) {
      logger.error({ error, id }, 'Error finding strategy');
      throw error;
    }
  },

  create: async (data, options = {}) => {
    try {
      return await CollectionStrategy.create(data, options);
    } catch (error) {
      logger.error({ error }, 'Error creating strategy');
      throw error;
    }
  },

  update: async (id, tenantId, data, options = {}) => {
    try {
      const [count] = await CollectionStrategy.update(data, {
        where: { id, tenantId },
        ...options,
      });
      return count;
    } catch (error) {
      logger.error({ error, id }, 'Error updating strategy');
      throw error;
    }
  },

  // Stages
  findStagesByStrategyId: async (strategyId, options = {}) => {
    try {
      return await CollectionStage.findAll({
        where: { strategyId },
        order: [['minDaysPastDue', 'ASC']],
        ...options,
      });
    } catch (error) {
      logger.error({ error, strategyId }, 'Error finding stages');
      throw error;
    }
  },

  findStageById: async (stageId, options = {}) => {
    try {
      return await CollectionStage.findByPk(stageId, options);
    } catch (error) {
      logger.error({ error, stageId }, 'Error finding stage');
      throw error;
    }
  },

  createStage: async (data, options = {}) => {
    try {
      return await CollectionStage.create(data, options);
    } catch (error) {
      logger.error({ error }, 'Error creating stage');
      throw error;
    }
  },

  updateStage: async (stageId, data, options = {}) => {
    try {
      const [count] = await CollectionStage.update(data, {
        where: { id: stageId },
        ...options,
      });
      return count;
    } catch (error) {
      logger.error({ error, stageId }, 'Error updating stage');
      throw error;
    }
  },

  softDeleteStage: async (stageId, options = {}) => {
    try {
      const [count] = await CollectionStage.update(
        { isActive: false },
        { where: { id: stageId }, ...options }
      );
      return count;
    } catch (error) {
      logger.error({ error, stageId }, 'Error soft-deleting stage');
      throw error;
    }
  },
};
