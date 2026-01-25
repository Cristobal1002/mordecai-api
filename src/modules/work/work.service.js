
import { listDueCallCases, scheduleDueCallCases } from '../../jobs/schedule-due-cases.js';

export const workService = {
    runWorker: async (tenantId, options = {}) => {
        const { limit = 50, perTenantLimit, dryRun = false } = options;

        if (dryRun) {
            const cases = await listDueCallCases({ tenantId, limit, perTenantLimit });
            return {
                dryRun: true,
                found: cases.length,
                cases,
            };
        }

        return await scheduleDueCallCases({ tenantId, limit, perTenantLimit });
    }
};
