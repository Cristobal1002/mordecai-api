
import { workService } from './work.service.js';

export const workController = {
    run: async (req, res, next) => {
        try {
            const { tenantId } = req.params;
            const { limit, dryRun } = req.body;

            const result = await workService.runWorker(tenantId, { limit, dryRun });
            res.success(result, 'Worker run completed');
        } catch (error) {
            next(error);
        }
    }
};
