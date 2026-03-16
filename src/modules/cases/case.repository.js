import {
  DebtCase,
  Debtor,
  CaseAutomationState,
  CollectionAutomation,
  CollectionStrategy,
  CollectionStage,
  CollectionEvent,
  InteractionLog,
} from '../../models/index.js';
import { logger } from '../../utils/logger.js';

export const caseRepository = {
  findDebtCaseById: async (debtCaseId, tenantId, options = {}) => {
    try {
      return await DebtCase.findOne({
        where: { id: debtCaseId, tenantId },
        include: [
          { model: Debtor, as: 'debtor' },
          {
            model: CaseAutomationState,
            as: 'automationStates',
            include: [
              { model: CollectionAutomation, as: 'automation', include: [{ model: CollectionStrategy, as: 'strategy', attributes: ['id', 'name'] }] },
              { model: CollectionStage, as: 'currentStage', attributes: ['id', 'name', 'minDaysPastDue', 'maxDaysPastDue'], required: false },
            ],
          },
        ],
        ...options,
      });
    } catch (error) {
      logger.error({ error, debtCaseId }, 'Error finding debt case');
      throw error;
    }
  },

  findEventsByDebtCaseId: async (debtCaseId, limit = 50, options = {}) => {
    try {
      return await CollectionEvent.findAll({
        where: { debtCaseId },
        order: [['createdAt', 'DESC']],
        limit,
        ...options,
      });
    } catch (error) {
      logger.error({ error, debtCaseId }, 'Error finding collection events');
      throw error;
    }
  },

  findInteractionLogsByDebtCaseId: async (debtCaseId, limit = 50, options = {}) => {
    try {
      return await InteractionLog.findAll({
        where: { debtCaseId },
        order: [['createdAt', 'DESC']],
        limit,
        ...options,
      });
    } catch (error) {
      logger.error({ error, debtCaseId }, 'Error finding interaction logs');
      throw error;
    }
  },

  findCaseAutomationState: async (debtCaseId, automationId, options = {}) => {
    try {
      return await CaseAutomationState.findOne({
        where: { debtCaseId, automationId },
        ...options,
      });
    } catch (error) {
      logger.error({ error, debtCaseId, automationId }, 'Error finding case automation state');
      throw error;
    }
  },

  updateCaseAutomationState: async (debtCaseId, automationId, data, options = {}) => {
    try {
      const [count] = await CaseAutomationState.update(data, {
        where: { debtCaseId, automationId },
        ...options,
      });
      return count;
    } catch (error) {
      logger.error({ error, debtCaseId, automationId }, 'Error updating case automation state');
      throw error;
    }
  },

  updateCaseAutomationStateById: async (id, data, options = {}) => {
    try {
      const [count] = await CaseAutomationState.update(data, {
        where: { id },
        ...options,
      });
      return count;
    } catch (error) {
      logger.error({ error, id }, 'Error updating case automation state by id');
      throw error;
    }
  },
};
