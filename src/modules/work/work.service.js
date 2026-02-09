
export const workService = {
    runWorker: async (tenantId, options = {}) => {
        const { limit = 50, perTenantLimit, dryRun = false } = options;

        return {
            disabled: true,
            tenantId,
            limit,
            perTenantLimit,
            dryRun,
            message: 'Worker scheduling was moved to the mordecai-workers service.',
        };
    }
};
