import { FlowPolicy } from '../../models/index.js';
import { logger } from '../../utils/logger.js';

export const flowPolicyRepository = {
  create: async (data, transaction) => {
    try {
      const options = transaction ? { transaction } : undefined;
      return await FlowPolicy.create(data, options);
    } catch (error) {
      logger.error({ error }, 'Error creating flow policy');
      throw error;
    }
  },

  findByTenant: async (tenantId, transaction) => {
    try {
      const options = transaction ? { transaction } : {};
      return await FlowPolicy.findAll({
        where: { tenantId },
        ...options,
      });
    } catch (error) {
      logger.error({ error }, 'Error finding flow policies');
      throw error;
    }
  },
};
