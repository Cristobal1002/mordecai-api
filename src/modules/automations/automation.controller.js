import { automationService } from './automation.service.js';

export const automationController = {
  list: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const pmsConnectionId = req.query.pmsConnectionId || null;
      const result = await automationService.list(tenantId, pmsConnectionId);
      res.ok(result, 'Automations retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  getById: async (req, res, next) => {
    try {
      const { tenantId, automationId } = req.params;
      const result = await automationService.getById(tenantId, automationId);
      res.ok(result, 'Automation retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  create: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const result = await automationService.create(tenantId, req.body);
      res.created(result, 'Automation created successfully');
    } catch (error) {
      next(error);
    }
  },

  activate: async (req, res, next) => {
    try {
      const { tenantId, automationId } = req.params;
      const result = await automationService.activate(tenantId, automationId);
      res.ok(result, 'Automation activated');
    } catch (error) {
      next(error);
    }
  },

  pause: async (req, res, next) => {
    try {
      const { tenantId, automationId } = req.params;
      const result = await automationService.pause(tenantId, automationId);
      res.ok(result, 'Automation paused');
    } catch (error) {
      next(error);
    }
  },

  stop: async (req, res, next) => {
    try {
      const { tenantId, automationId } = req.params;
      const result = await automationService.stop(tenantId, automationId);
      res.ok(result, 'Automation stopped');
    } catch (error) {
      next(error);
    }
  },

  delete: async (req, res, next) => {
    try {
      const { tenantId, automationId } = req.params;
      const result = await automationService.delete(tenantId, automationId);
      res.ok(result, 'Automation deleted');
    } catch (error) {
      next(error);
    }
  },

  getSummary: async (req, res, next) => {
    try {
      const { tenantId, automationId } = req.params;
      const result = await automationService.getSummary(tenantId, automationId);
      res.ok(result, 'Automation summary retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  getCases: async (req, res, next) => {
    try {
      const { tenantId, automationId } = req.params;
      const limit = parseInt(req.query.limit, 10) || 100;
      const offset = parseInt(req.query.offset, 10) || 0;
      const result = await automationService.getCases(tenantId, automationId, limit, offset);
      res.ok(result, 'Automation cases retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  getActivity: async (req, res, next) => {
    try {
      const { tenantId, automationId } = req.params;
      const limit = parseInt(req.query.limit, 10) || 50;
      const result = await automationService.getActivity(tenantId, automationId, limit);
      res.ok(result, 'Automation activity retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  enroll: async (req, res, next) => {
    try {
      const { tenantId, automationId } = req.params;
      const debtCaseIds = req.body?.debtCaseIds;
      const result = await automationService.enroll(tenantId, automationId, {
        debtCaseIds: Array.isArray(debtCaseIds) ? debtCaseIds : undefined,
      });
      res.ok(result, 'Enrollment completed');
    } catch (error) {
      next(error);
    }
  },

  recomputeStages: async (req, res, next) => {
    try {
      const { tenantId, automationId } = req.params;
      const result = await automationService.recomputeStagesForAutomation(tenantId, automationId);
      res.ok(result, 'Stages recomputed');
    } catch (error) {
      next(error);
    }
  },
};
