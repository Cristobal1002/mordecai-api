import {
  CollectionAutomation,
  CollectionStrategy,
  CollectionEvent,
  CaseAutomationState,
  DebtCase,
  Debtor,
  PmsConnection,
  CollectionStage,
  PaymentAgreement,
  CaseDispute,
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
          startedAt: data.startedAt !== undefined ? data.startedAt : new Date(),
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
      const { tab, filters = {} } = options;
      const statusArr = filters.status;
      const stageArr = filters.stage;
      const dpdMin = filters.dpdMin;
      const dpdMax = filters.dpdMax;
      const amountMinCents = filters.amountMinCents;
      const amountMaxCents = filters.amountMaxCents;
      let debtCaseWhere;
      let stateStatuses = ['active'];

      if (statusArr && statusArr.length > 0) {
        const approvalOnly = statusArr.filter((s) => s !== 'IN_DISPUTE');
        const hasExcluded = approvalOnly.includes('EXCLUDED');
        if (hasExcluded) stateStatuses = ['active', 'closed'];
        if (approvalOnly.length > 0) {
          debtCaseWhere = { approvalStatus: { [Op.in]: approvalOnly } };
        }
        if (statusArr.includes('IN_DISPUTE') && approvalOnly.length === 0) {
          const seq = DebtCase.sequelize;
          debtCaseWhere = seq.literal(`"debt_cases"."id" IN (SELECT "debt_case_id" FROM "case_disputes" WHERE "status" = 'OPEN')`);
        } else if (statusArr.includes('IN_DISPUTE') && approvalOnly.length > 0) {
          const seq = DebtCase.sequelize;
          debtCaseWhere = {
            [Op.or]: [
              { approvalStatus: { [Op.in]: approvalOnly } },
              seq.literal(`"debt_cases"."id" IN (SELECT "debt_case_id" FROM "case_disputes" WHERE "status" = 'OPEN')`),
            ],
          };
        }
      } else if (tab === 'pending') {
        debtCaseWhere = { approvalStatus: 'PENDING_APPROVAL' };
      } else if (tab === 'active') {
        debtCaseWhere = { approvalStatus: 'APPROVED' };
      } else if (tab === 'excluded') {
        debtCaseWhere = { approvalStatus: 'EXCLUDED' };
        stateStatuses = ['active', 'closed'];
      }

      const extraWhere = {};
      if (dpdMin != null) extraWhere.daysPastDue = { ...extraWhere.daysPastDue, [Op.gte]: dpdMin };
      if (dpdMax != null) extraWhere.daysPastDue = { ...extraWhere.daysPastDue, [Op.lte]: dpdMax };
      if (amountMinCents != null) extraWhere.amountDueCents = { ...extraWhere.amountDueCents, [Op.gte]: amountMinCents };
      if (amountMaxCents != null) extraWhere.amountDueCents = { ...extraWhere.amountDueCents, [Op.lte]: amountMaxCents };
      if (Object.keys(extraWhere).length > 0) {
        debtCaseWhere = debtCaseWhere
          ? { [Op.and]: [debtCaseWhere, extraWhere] }
          : extraWhere;
      }

      const includeOpts = [];
      if (debtCaseWhere) {
        includeOpts.push({
          model: DebtCase,
          as: 'debtCase',
          required: true,
          where: debtCaseWhere,
        });
      }
      if (stageArr && stageArr.length > 0) {
        includeOpts.push({
          model: CollectionStage,
          as: 'currentStage',
          required: true,
          where: { name: { [Op.in]: stageArr } },
        });
      }

      return await CaseAutomationState.count({
        where: { automationId, status: { [Op.in]: stateStatuses }, ...whereExtra },
        include: includeOpts.length > 0 ? includeOpts : undefined,
        distinct: true,
        ...options,
      });
    } catch (error) {
      logger.error({ error, automationId }, 'Error counting case states');
      throw error;
    }
  },

  findCaseStates: async (automationId, options = {}) => {
    try {
      const { tab, filters = {} } = options;
      const statusArr = filters.status;
      const stageArr = filters.stage;
      const dpdMin = filters.dpdMin;
      const dpdMax = filters.dpdMax;
      const amountMinCents = filters.amountMinCents;
      const amountMaxCents = filters.amountMaxCents;
      let debtCaseWhere;
      let stateStatuses = ['active'];
      let excludeDisputedFromApproved = false;

      if (statusArr && statusArr.length > 0) {
        const approvalOnly = statusArr.filter((s) => s !== 'IN_DISPUTE');
        const hasExcluded = approvalOnly.includes('EXCLUDED');
        if (hasExcluded) stateStatuses = ['active', 'closed'];
        if (approvalOnly.length > 0) {
          debtCaseWhere = { approvalStatus: { [Op.in]: approvalOnly } };
        }
        if (statusArr.includes('IN_DISPUTE') && approvalOnly.length === 0) {
          const seq = DebtCase.sequelize;
          debtCaseWhere = seq.literal(`"debt_cases"."id" IN (SELECT "debt_case_id" FROM "case_disputes" WHERE "status" = 'OPEN')`);
        } else if (statusArr.includes('IN_DISPUTE') && approvalOnly.length > 0) {
          const seq = DebtCase.sequelize;
          debtCaseWhere = {
            [Op.or]: [
              { approvalStatus: { [Op.in]: approvalOnly } },
              seq.literal(`"debt_cases"."id" IN (SELECT "debt_case_id" FROM "case_disputes" WHERE "status" = 'OPEN')`),
            ],
          };
        }
        excludeDisputedFromApproved = approvalOnly.includes('APPROVED') && !statusArr.includes('IN_DISPUTE');
      } else if (tab === 'pending') {
        debtCaseWhere = { approvalStatus: 'PENDING_APPROVAL' };
      } else if (tab === 'active') {
        debtCaseWhere = { approvalStatus: 'APPROVED' };
        excludeDisputedFromApproved = true;
      } else if (tab === 'excluded') {
        debtCaseWhere = { approvalStatus: 'EXCLUDED' };
        stateStatuses = ['active', 'closed'];
      }

      const extraWhere = {};
      if (dpdMin != null) extraWhere.daysPastDue = { ...extraWhere.daysPastDue, [Op.gte]: dpdMin };
      if (dpdMax != null) extraWhere.daysPastDue = { ...extraWhere.daysPastDue, [Op.lte]: dpdMax };
      if (amountMinCents != null) extraWhere.amountDueCents = { ...extraWhere.amountDueCents, [Op.gte]: amountMinCents };
      if (amountMaxCents != null) extraWhere.amountDueCents = { ...extraWhere.amountDueCents, [Op.lte]: amountMaxCents };
      if (Object.keys(extraWhere).length > 0) {
        debtCaseWhere = debtCaseWhere
          ? { [Op.and]: [debtCaseWhere, extraWhere] }
          : extraWhere;
      }

      const currentStageInclude = {
        model: CollectionStage,
        as: 'currentStage',
        attributes: ['id', 'name', 'minDaysPastDue', 'maxDaysPastDue'],
        required: stageArr && stageArr.length > 0,
        ...(stageArr && stageArr.length > 0 ? { where: { name: { [Op.in]: stageArr } } } : {}),
      };

      const { sortBy, sortOrder = 'ASC' } = options;
      let orderClause = options.order;
      if (!orderClause && sortBy) {
        if (sortBy === 'debtorName') {
          orderClause = [['debtCase', 'debtor', 'fullName', sortOrder]];
        } else if (sortBy === 'amountDueCents') {
          orderClause = [['debtCase', 'amountDueCents', sortOrder]];
        } else if (sortBy === 'daysPastDue') {
          orderClause = [['debtCase', 'daysPastDue', sortOrder]];
        } else if (sortBy === 'approvalStatus') {
          orderClause = [['debtCase', 'approvalStatus', sortOrder]];
        }
      }
      if (!orderClause) {
        orderClause = [
          ['nextActionAt', 'ASC'],
          ['lastAttemptAt', 'DESC'],
        ];
      }

      const rows = await CaseAutomationState.findAll({
        where: { automationId, status: { [Op.in]: stateStatuses } },
        include: [
          {
            model: DebtCase,
            as: 'debtCase',
            required: true,
            where: debtCaseWhere,
            include: [{ model: Debtor, as: 'debtor', attributes: ['id', 'fullName', 'email', 'phone'] }],
          },
          currentStageInclude,
        ],
        order: orderClause,
        ...options,
      });

      if (excludeDisputedFromApproved && rows.length > 0) {
        const debtCaseIds = rows.map((r) => r.debtCaseId);
        const openDisputeIds = new Set(
          (await CaseDispute.findAll({
            where: { debtCaseId: { [Op.in]: debtCaseIds }, status: 'OPEN' },
            attributes: ['debtCaseId'],
            raw: true,
          })).map((r) => r.debt_case_id ?? r.debtCaseId)
        );
        return rows.filter((r) => !openDisputeIds.has(r.debtCaseId));
      }
      return rows;
    } catch (error) {
      logger.error({ error, automationId }, 'Error finding case states');
      throw error;
    }
  },

  findDisputesByAutomation: async (automationId, tenantId, options = {}) => {
    try {
      const enrolledIds = await automationRepository.findEnrolledDebtCaseIds(automationId);
      if (enrolledIds.length === 0) return [];

      return await CaseDispute.findAll({
        where: {
          tenantId,
          debtCaseId: { [Op.in]: enrolledIds },
          status: 'OPEN',
        },
        include: [
          {
            model: DebtCase,
            as: 'debtCase',
            required: true,
            include: [{ model: Debtor, as: 'debtor', attributes: ['id', 'fullName', 'email', 'phone'] }],
          },
        ],
        order: [['openedAt', 'DESC']],
        ...options,
      });
    } catch (error) {
      logger.error({ error, automationId }, 'Error finding disputes for automation');
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

  getOverviewData: async (automationId, tenantId) => {
    try {
      const enrolledIds = await automationRepository.findEnrolledDebtCaseIds(automationId);

      const [total, pendingApproval, active, excluded, disputes, stageRows] = await Promise.all([
        CaseAutomationState.count({ where: { automationId } }),
        automationRepository.countCaseStates(automationId, {}, { tab: 'pending' }),
        automationRepository.countCaseStates(automationId, {}, { tab: 'active' }),
        automationRepository.countCaseStates(automationId, {}, { tab: 'excluded' }),
        enrolledIds.length === 0
          ? 0
          : CaseDispute.count({
              where: { tenantId, debtCaseId: { [Op.in]: enrolledIds }, status: 'OPEN' },
            }),
        CaseAutomationState.findAll({
          where: { automationId, status: 'active' },
          attributes: ['currentStageId'],
          include: [
            {
              model: DebtCase,
              as: 'debtCase',
              required: true,
              attributes: ['amountDueCents', 'daysPastDue'],
            },
            { model: CollectionStage, as: 'currentStage', attributes: ['id', 'name'], required: false },
          ],
        }),
      ]);

      const MAX_CENTS_PER_CASE = 1e10; // ~$100M per case - cap to avoid overflow al sumar
      const MAX_TOTAL_CENTS = 1e12; // ~$10B total
      const safeCents = (v, max = MAX_CENTS_PER_CASE) => {
        const n = parseInt(v, 10);
        if (!Number.isFinite(n)) return 0;
        return Math.min(Math.max(n, -max), max);
      };

      const stageMap = new Map();
      for (const row of stageRows || []) {
        const plain = row.get ? row.get({ plain: true }) : row;
        const stageId = plain.currentStageId ?? plain.current_stage_id;
        const stageName = plain.currentStage?.name ?? 'Unknown';
        const key = stageId ?? stageName;
        if (!stageMap.has(key)) {
          stageMap.set(key, { stageId, name: stageName, cases: 0, amount: 0, dpdSum: 0 });
        }
        const rec = stageMap.get(key);
        rec.cases += 1;
        rec.amount += safeCents(plain.debtCase?.amountDueCents ?? plain.debtCase?.amount_due_cents ?? 0);
        rec.dpdSum += safeCents(plain.debtCase?.daysPastDue ?? plain.debtCase?.days_past_due ?? 0);
      }
      const stages = [...stageMap.values()].map((s) => ({
        stageId: s.stageId,
        name: s.name,
        cases: s.cases,
        amount: safeCents(s.amount),
        avgDpd: s.cases > 0 ? Math.round(s.dpdSum / s.cases) : 0,
      }));

      const totalExposure = safeCents(
        stages.reduce((sum, s) => sum + (s.amount || 0), 0),
        MAX_TOTAL_CENTS
      );
      const highDpdCount = await CaseAutomationState.count({
        where: { automationId, status: 'active' },
        include: [
          {
            model: DebtCase,
            as: 'debtCase',
            required: true,
            where: { approvalStatus: 'APPROVED', daysPastDue: { [Op.gt]: 30 } },
            attributes: [],
          },
        ],
      });

      return {
        counts: {
          total,
          totalExposure,
          pendingApproval,
          active,
          excluded,
          disputes,
          highDpd: highDpdCount,
        },
        stages,
      };
    } catch (error) {
      logger.error({ error, automationId }, 'Error getting overview data');
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

  findAgreements: async (automationId, tenantId, options = {}) => {
    try {
      const debtCaseIds = await automationRepository.findEnrolledDebtCaseIds(automationId, options);
      if (debtCaseIds.length === 0) return [];

      return await PaymentAgreement.findAll({
        where: { debtCaseId: { [Op.in]: debtCaseIds }, tenantId },
        include: [
          {
            model: DebtCase,
            as: 'debtCase',
            required: true,
            attributes: ['id', 'amountDueCents', 'currency', 'status'],
            include: [{ model: Debtor, as: 'debtor', attributes: ['id', 'fullName', 'email', 'phone'] }],
          },
        ],
        order: [['createdAt', 'DESC']],
        ...options,
      });
    } catch (error) {
      logger.error({ error, automationId }, 'Error finding automation agreements');
      throw error;
    }
  },
};
