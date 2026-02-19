import {
  CollectionAutomation,
  CollectionStrategy,
  CollectionEvent,
  CaseAutomationState,
  DebtCase,
  Debtor,
  PmsConnection,
  CollectionStage,
} from '../../models/index.js';
import { Op } from 'sequelize';
import { logger } from '../../utils/logger.js';

export const automationRepository = {
  findByTenant: async (tenantId, options = {}) => {
    try {
      const where = { tenantId };
      return await CollectionAutomation.findAll({
        where,
        include: [
          { model: PmsConnection, as: 'pmsConnection', attributes: ['id', 'softwareId', 'status'], include: [{ association: 'software', attributes: ['id', 'key', 'name'] }] },
          { model: CollectionStrategy, as: 'strategy', attributes: ['id', 'name', 'isActive'] },
        ],
        order: [['createdAt', 'DESC']],
        ...options,
      });
    } catch (error) {
      logger.error({ error, tenantId }, 'Error finding automations');
      throw error;
    }
  },

  findByConnection: async (tenantId, pmsConnectionId, options = {}) => {
    try {
      return await CollectionAutomation.findAll({
        where: { tenantId, pmsConnectionId },
        include: [
          { model: PmsConnection, as: 'pmsConnection', attributes: ['id', 'softwareId', 'status'] },
          { model: CollectionStrategy, as: 'strategy', attributes: ['id', 'name', 'isActive'] },
        ],
        order: [['createdAt', 'DESC']],
        ...options,
      });
    } catch (error) {
      logger.error({ error, tenantId, pmsConnectionId }, 'Error finding automations by connection');
      throw error;
    }
  },

  findById: async (id, tenantId, options = {}) => {
    try {
      return await CollectionAutomation.findOne({
        where: { id, tenantId },
        include: [
          { model: PmsConnection, as: 'pmsConnection', include: [{ association: 'software', attributes: ['id', 'key', 'name'] }] },
          { model: CollectionStrategy, as: 'strategy', include: [{ model: CollectionStage, as: 'stages' }] },
        ],
        ...options,
      });
    } catch (error) {
      logger.error({ error, id }, 'Error finding automation');
      throw error;
    }
  },

  create: async (data, options = {}) => {
    try {
      return await CollectionAutomation.create(
        {
          ...data,
          status: data.status ?? 'active',
          startedAt: data.startedAt ?? new Date(),
        },
        options
      );
    } catch (error) {
      logger.error({ error }, 'Error creating automation');
      throw error;
    }
  },

  update: async (id, tenantId, data, options = {}) => {
    try {
      const [count] = await CollectionAutomation.update(data, {
        where: { id, tenantId },
        ...options,
      });
      return count;
    } catch (error) {
      logger.error({ error, id }, 'Error updating automation');
      throw error;
    }
  },

  delete: async (id, tenantId, options = {}) => {
    try {
      const count = await CollectionAutomation.destroy({
        where: { id, tenantId },
        ...options,
      });
      return count;
    } catch (error) {
      logger.error({ error, id }, 'Error deleting automation');
      throw error;
    }
  },

  countCaseStates: async (automationId, whereExtra = {}, options = {}) => {
    try {
      return await CaseAutomationState.count({
        where: { automationId, ...whereExtra },
        ...options,
      });
    } catch (error) {
      logger.error({ error, automationId }, 'Error counting case states');
      throw error;
    }
  },

  findCaseStates: async (automationId, options = {}) => {
    try {
      return await CaseAutomationState.findAll({
        where: { automationId },
        include: [
          {
            model: DebtCase,
            as: 'debtCase',
            required: true,
            include: [{ model: Debtor, as: 'debtor', attributes: ['id', 'fullName', 'email', 'phone'] }],
          },
          { model: CollectionStage, as: 'currentStage', attributes: ['id', 'name', 'minDaysPastDue', 'maxDaysPastDue'], required: false },
        ],
        order: [
          ['nextActionAt', 'ASC'],
          ['lastAttemptAt', 'DESC'],
        ],
        ...options,
      });
    } catch (error) {
      logger.error({ error, automationId }, 'Error finding case states');
      throw error;
    }
  },

  findEvents: async (automationId, limit = 50, options = {}) => {
    try {
      return await CollectionEvent.findAll({
        where: { automationId },
        order: [['createdAt', 'DESC']],
        limit,
        ...options,
      });
    } catch (error) {
      logger.error({ error, automationId }, 'Error finding automation events');
      throw error;
    }
  },

  findEnrolledDebtCaseIds: async (automationId, options = {}) => {
    try {
      const rows = await CaseAutomationState.findAll({
        where: { automationId },
        attributes: ['debtCaseId'],
        raw: true,
        ...options,
      });
      return rows.map((r) => r.debt_case_id ?? r.debtCaseId);
    } catch (error) {
      logger.error({ error, automationId }, 'Error finding enrolled debt case ids');
      throw error;
    }
  },
};
