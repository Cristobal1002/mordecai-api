
import { Tenant } from '../../models/index.js';
import { logger } from '../../utils/logger.js';

export const tenantRepository = {
    create: async (data) => {
        try {
            return await Tenant.create(data);
        } catch (error) {
            logger.error({ error }, 'Error creating tenant');
            throw error;
        }
    },

    findById: async (id) => {
        try {
            return await Tenant.findByPk(id);
        } catch (error) {
            logger.error({ error }, 'Error finding tenant');
            throw error;
        }
    },

    findByEmail: async (email) => {
        try {
            return await Tenant.findOne({ where: { email } });
        } catch (error) {
            logger.error({ error }, 'Error finding tenant by email');
            throw error;
        }
    }
};
