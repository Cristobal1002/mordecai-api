
import { DebtCase, InteractionLog, Debtor, FlowPolicy } from '../../models/index.js';

export const debtCaseService = {
    list: async (tenantId, params = {}) => {
        const limit = params.limit || 50;
        const offset = params.offset || 0;

        return await DebtCase.findAndCountAll({
            where: { tenantId },
            include: [
                { model: Debtor },
                { model: FlowPolicy, as: 'flowPolicy' }
            ],
            limit,
            offset,
            order: [['updatedAt', 'DESC']]
        });
    },

    getInteractionLogs: async (tenantId, caseId) => {
        // Basic check if case belongs to tenant
        const debtCase = await DebtCase.findOne({ where: { id: caseId, tenantId } });
        if (!debtCase) throw new Error('Debt Case not found');

        return await InteractionLog.findAll({
            where: { debtCaseId: caseId },
            order: [['createdAt', 'DESC']]
        });
    }
};
