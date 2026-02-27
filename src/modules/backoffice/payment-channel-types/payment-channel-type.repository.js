import { PaymentChannelType } from '../../../models/index.js';
import { logger } from '../../../utils/logger.js';

export const paymentChannelTypeRepository = {
  findAll: async (options = {}) => {
    try {
      return await PaymentChannelType.findAll({
        order: [
          ['sortOrder', 'ASC'],
          ['label', 'ASC'],
        ],
        ...options,
      });
    } catch (error) {
      logger.error({ error }, 'Error finding payment channel types');
      throw error;
    }
  },

  findById: async (id, options = {}) => {
    try {
      return await PaymentChannelType.findByPk(id, options);
    } catch (error) {
      logger.error({ error, id }, 'Error finding payment channel type by id');
      throw error;
    }
  },

  findByCode: async (code, options = {}) => {
    try {
      return await PaymentChannelType.findOne({
        where: { code },
        ...options,
      });
    } catch (error) {
      logger.error({ error, code }, 'Error finding payment channel type by code');
      throw error;
    }
  },

  create: async (data, options = {}) => {
    try {
      return await PaymentChannelType.create(data, options);
    } catch (error) {
      logger.error({ error }, 'Error creating payment channel type');
      throw error;
    }
  },

  update: async (id, data, options = {}) => {
    try {
      const [count] = await PaymentChannelType.update(data, {
        where: { id },
        ...options,
      });
      return count;
    } catch (error) {
      logger.error({ error, id }, 'Error updating payment channel type');
      throw error;
    }
  },

  delete: async (id, options = {}) => {
    try {
      return await PaymentChannelType.destroy({
        where: { id },
        ...options,
      });
    } catch (error) {
      logger.error({ error, id }, 'Error deleting payment channel type');
      throw error;
    }
  },
};
