import { disputeService } from './dispute.service.js';

export const disputeController = {
  create: async (req, res, next) => {
    try {
      const { tenantId, caseId } = req.params;
      const result = await disputeService.create(
        tenantId,
        caseId,
        req.body,
        req.user?.id
      );
      res.created(result, 'Dispute created');
    } catch (e) {
      next(e);
    }
  },

  resolve: async (req, res, next) => {
    try {
      const { tenantId, disputeId } = req.params;
      const result = await disputeService.resolve(
        tenantId,
        disputeId,
        req.body,
        req.user?.id
      );
      res.ok(result, 'Dispute resolved');
    } catch (e) {
      next(e);
    }
  },
};
