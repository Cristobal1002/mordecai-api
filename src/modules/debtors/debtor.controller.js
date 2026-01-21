
import { debtorService } from './debtor.service.js';

export const debtorController = {
    list: async (req, res, next) => {
        try {
            const { tenantId } = req.params;
            const { limit, offset } = req.query;

            const result = await debtorService.list(tenantId, { limit, offset });
            res.success(result, 'Debtors retrieved successfully');
        } catch (error) {
            next(error);
        }
    }
};
