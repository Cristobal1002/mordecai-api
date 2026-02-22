import { caseService } from './case.service.js';

export const caseController = {
  getDetail: async (req, res, next) => {
    try {
      const { tenantId, caseId } = req.params;
      const result = await caseService.getDetail(tenantId, caseId);
      res.ok(result, 'Case detail retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  getTimeline: async (req, res, next) => {
    try {
      const { tenantId, caseId } = req.params;
      const limit = parseInt(req.query.limit, 10) || 50;
      const result = await caseService.getTimeline(tenantId, caseId, limit);
      res.ok(result, 'Case timeline retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  pause: async (req, res, next) => {
    try {
      const { tenantId, caseId } = req.params;
      const automationId = req.body?.automationId || null;
      const result = await caseService.pause(tenantId, caseId, automationId);
      res.ok(result, 'Case paused');
    } catch (error) {
      next(error);
    }
  },

  resume: async (req, res, next) => {
    try {
      const { tenantId, caseId } = req.params;
      const automationId = req.body?.automationId || null;
      const result = await caseService.resume(tenantId, caseId, automationId);
      res.ok(result, 'Case resumed');
    } catch (error) {
      next(error);
    }
  },

  triggerCall: async (req, res, next) => {
    try {
      const { tenantId, caseId } = req.params;
      const result = await caseService.triggerCall(tenantId, caseId);
      res.ok(result, result.message || 'Call enqueued');
    } catch (error) {
      next(error);
    }
  },
};
