
import { tenantService } from './tenant.service.js';

export const tenantController = {
    create: async (req, res, next) => {
        try {
            const result = await tenantService.create(req.body);
            res.created(result, 'Tenant created successfully');
        } catch (error) {
            next(error);
        }
    },

    seedFlowPolicies: async (req, res, next) => {
        try {
            const { tenantId } = req.params;
            const result = await tenantService.seedFlowPolicies(tenantId);
            res.success(result, 'Flow policies seeded successfully');
        } catch (error) {
            next(error);
        }
    }
};
