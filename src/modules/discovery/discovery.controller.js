import { discoveryService } from './discovery.service.js';

export const discoveryController = {
  getSession: async (req, res, next) => {
    try {
      const { clientSessionId } = req.params;
      const row = await discoveryService.getByClientSessionId(clientSessionId);
      if (!row) {
        return res.notFound('Discovery session not found');
      }
      return res.ok(row, 'Discovery session retrieved');
    } catch (error) {
      return next(error);
    }
  },

  upsertSession: async (req, res, next) => {
    try {
      const { clientSessionId } = req.params;
      const { answers, currentStepIndex, completed } = req.body;
      const row = await discoveryService.upsert(
        clientSessionId,
        { answers, currentStepIndex, completed: Boolean(completed) },
        req
      );
      return res.ok(row, 'Discovery session saved');
    } catch (error) {
      return next(error);
    }
  },
};
