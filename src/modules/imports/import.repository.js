
import { ImportBatch } from '../../models/index.js';
import { logger } from '../../utils/logger.js';

export const importRepository = {
    create: async (data, transaction) => {
        try {
            return await ImportBatch.create(data, { transaction });
        } catch (error) {
            logger.error({ error }, 'Error creating import batch');
            throw error;
        }
    },

    findById: async (id) => {
        try {
            return await ImportBatch.findByPk(id);
        } catch (error) {
            logger.error({ error }, 'Error finding import batch');
            throw error;
        }
    },

    update: async (id, data, transaction) => {
        try {
            const [updated] = await ImportBatch.update(data, {
                where: { id },
                transaction,
                returning: true
            });
            return updated > 0;
        } catch (error) {
            logger.error({ error }, 'Error updating import batch');
            throw error;
        }
    }
};
