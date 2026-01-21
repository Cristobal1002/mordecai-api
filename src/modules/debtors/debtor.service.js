
import { Debtor } from '../../models/index.js';

export const debtorService = {
    list: async (tenantId, params = {}) => {
        const limit = params.limit || 50;
        const offset = params.offset || 0;

        return await Debtor.findAndCountAll({
            where: { tenantId },
            limit,
            offset,
            order: [['createdAt', 'DESC']]
        });
    }
};
