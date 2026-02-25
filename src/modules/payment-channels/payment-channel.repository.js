import { TenantPaymentChannel } from '../../models/index.js';
import { logger } from '../../utils/logger.js';

export const paymentChannelRepository = {
  findByTenant: async (tenantId, options = {}) => {
    try {
      return await TenantPaymentChannel.findAll({
        where: { tenantId, isActive: true },
        order: [
          ['sortOrder', 'ASC'],
          ['label', 'ASC'],
        ],
        ...options,
      });
    } catch (error) {
      logger.error({ error, tenantId }, 'Error finding payment channels');
      throw error;
    }
  },

  findAllByTenant: async (tenantId, options = {}) => {
    try {
      return await TenantPaymentChannel.findAll({
        where: { tenantId },
        order: [
          ['sortOrder', 'ASC'],
          ['label', 'ASC'],
        ],
        ...options,
      });
    } catch (error) {
      logger.error({ error, tenantId }, 'Error finding payment channels');
      throw error;
    }
  },

  findById: async (id, tenantId, options = {}) => {
    try {
      return await TenantPaymentChannel.findOne({
        where: { id, tenantId },
        ...options,
      });
    } catch (error) {
      logger.error({ error, id }, 'Error finding payment channel');
      throw error;
    }
  },

  findByCode: async (tenantId, code, options = {}) => {
    try {
      return await TenantPaymentChannel.findOne({
        where: { tenantId, code },
        ...options,
      });
    } catch (error) {
      logger.error({ error, tenantId, code }, 'Error finding payment channel by code');
      throw error;
    }
  },

  create: async (data, options = {}) => {
    try {
      return await TenantPaymentChannel.create(data, options);
    } catch (error) {
      logger.error({ error }, 'Error creating payment channel');
      throw error;
    }
  },

  update: async (id, tenantId, data, options = {}) => {
    try {
      const [count] = await TenantPaymentChannel.update(data, {
        where: { id, tenantId },
        ...options,
      });
      return count;
    } catch (error) {
      logger.error({ error, id }, 'Error updating payment channel');
      throw error;
    }
  },

  delete: async (id, tenantId, options = {}) => {
    try {
      const count = await TenantPaymentChannel.destroy({
        where: { id, tenantId },
        ...options,
      });
      return count;
    } catch (error) {
      logger.error({ error, id }, 'Error deleting payment channel');
      throw error;
    }
  },
};
