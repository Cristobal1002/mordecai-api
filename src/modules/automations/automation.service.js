import { Op } from 'sequelize';
import { CaseAutomationState, PmsConnection, DebtCase } from '../../models/index.js';
import { automationRepository } from './automation.repository.js';
import { tenantRepository } from '../tenants/tenant.repository.js';
import { strategyRepository } from '../strategies/strategy.repository.js';
import { NotFoundError, ConflictError } from '../../errors/index.js';
import { logger } from '../../utils/logger.js';

const ELIGIBLE_STATUSES = ['NEW', 'IN_PROGRESS', 'CONTACTED', 'PROMISE_TO_PAY', 'PAYMENT_PLAN', 'NO_ANSWER', 'REFUSED'];

function selectStageByDaysPastDue(stages, daysPastDue) {
  const active = (stages || []).filter((s) => s.isActive !== false);
  const sorted = [...active].sort((a, b) => a.minDaysPastDue - b.minDaysPastDue);
  if (sorted.length === 0) return null;

  // DPD above the highest defined max (e.g. 202 when Special is 31–150) → last stage
  const stagesWithMax = sorted.filter((s) => s.maxDaysPastDue != null);
  const highestMax = stagesWithMax.length
    ? Math.max(...stagesWithMax.map((s) => Number(s.maxDaysPastDue)))
    : 0;
  if (daysPastDue > highestMax) return sorted[sorted.length - 1];

  // Among stages that match, pick the most specific (largest minDaysPastDue)
  const matching = sorted.filter((s) => {
    const minOk = daysPastDue >= Number(s.minDaysPastDue);
    const maxOk = s.maxDaysPastDue == null || daysPastDue <= Number(s.maxDaysPastDue);
    return minOk && maxOk;
  });
  if (matching.length > 0) return matching[matching.length - 1];

  // DPD before first range (e.g. 0 when first is 1–5) → first stage
  if (daysPastDue < sorted[0].minDaysPastDue) return sorted[0];
  // Fallback → last stage
  return sorted[sorted.length - 1];
}

function startOfToday() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export const automationService = {
  list: async (tenantId, pmsConnectionId = null) => {
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant');

    if (pmsConnectionId) {
      return await automationRepository.findByConnection(tenantId, pmsConnectionId);
    }
    return await automationRepository.findByTenant(tenantId);
  },

  getById: async (tenantId, automationId) => {
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant');
    const automation = await automationRepository.findById(automationId, tenantId);
    if (!automation) throw new NotFoundError('Automation');
    return automation;
  },

  create: async (tenantId, data) => {
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant');

    const connection = await PmsConnection.findOne({ where: { id: data.pmsConnectionId, tenantId } });
    if (!connection) throw new NotFoundError('PMS connection');

    const strategy = await strategyRepository.findById(data.strategyId, tenantId);
    if (!strategy) throw new NotFoundError('Strategy');

    const existing = await automationRepository.findByConnection(tenantId, data.pmsConnectionId);
    const sameStrategy = existing.find((a) => a.strategyId === data.strategyId && a.status !== 'stopped');
    if (sameStrategy) {
      throw new ConflictError('An automation with this strategy is already running (or paused) on this connection');
    }

    const automation = await automationRepository.create({
      tenantId,
      pmsConnectionId: data.pmsConnectionId,
      strategyId: data.strategyId,
      status: 'active',
      startedAt: new Date(),
      stats: {},
    });

    // Auto-enroll eligible cases so the Cases tab has data immediately
    try {
      await automationService.enroll(tenantId, automation.id, {});
    } catch (err) {
      logger.warn({ err, automationId: automation.id }, 'Auto-enroll after create failed (e.g. no stages or no eligible cases)');
    }

    return await automationRepository.findById(automation.id, tenantId);
  },

  activate: async (tenantId, automationId) => {
    const automation = await automationRepository.findById(automationId, tenantId);
    if (!automation) throw new NotFoundError('Automation');
    await automationRepository.update(automationId, tenantId, {
      status: 'active',
      pausedAt: null,
      nextTickAt: new Date(),
    });
    return await automationRepository.findById(automationId, tenantId);
  },

  pause: async (tenantId, automationId) => {
    const automation = await automationRepository.findById(automationId, tenantId);
    if (!automation) throw new NotFoundError('Automation');
    await automationRepository.update(automationId, tenantId, {
      status: 'paused',
      pausedAt: new Date(),
    });
    return await automationRepository.findById(automationId, tenantId);
  },

  stop: async (tenantId, automationId) => {
    const automation = await automationRepository.findById(automationId, tenantId);
    if (!automation) throw new NotFoundError('Automation');
    await automationRepository.update(automationId, tenantId, { status: 'stopped' });
    return await automationRepository.findById(automationId, tenantId);
  },

  delete: async (tenantId, automationId) => {
    const automation = await automationRepository.findById(automationId, tenantId);
    if (!automation) throw new NotFoundError('Automation');
    await automationRepository.delete(automationId, tenantId);
    return { deleted: true, automationId };
  },

  getSummary: async (tenantId, automationId) => {
    const automation = await automationRepository.findById(automationId, tenantId);
    if (!automation) throw new NotFoundError('Automation');

    const now = new Date();
    const todayStart = startOfToday();

    const targetCases = await automationRepository.countCaseStates(automationId, { status: 'active' });
    const contactedToday = await CaseAutomationState.count({
      where: {
        automationId,
        status: 'active',
        lastAttemptAt: { [Op.gte]: todayStart },
      },
    });
    const nextScheduled = await CaseAutomationState.count({
      where: {
        automationId,
        status: 'active',
        nextActionAt: { [Op.lte]: now, [Op.ne]: null },
      },
    });
    const promisesActive = await CaseAutomationState.count({
      where: {
        automationId,
        status: 'active',
        promiseDueDate: { [Op.gte]: now.toISOString().slice(0, 10) },
      },
    });

    return {
      automationId,
      strategyName: automation.strategy?.name,
      status: automation.status,
      targetCases,
      contactedToday,
      nextScheduled,
      promisesActive,
      recovered: automation.stats?.recovered ?? 0,
    };
  },

  getCases: async (tenantId, automationId, limit = 100, offset = 0) => {
    const automation = await automationRepository.findById(automationId, tenantId);
    if (!automation) throw new NotFoundError('Automation');

    const rows = await automationRepository.findCaseStates(automationId, {
      limit: Math.min(limit, 200),
      offset,
    });
    const total = await automationRepository.countCaseStates(automationId, { status: 'active' });

    const data = rows.map((s) => {
      const plain = s.get ? s.get({ plain: true }) : s;
      const debtCase = plain.debtCase || {};
      const debtor = debtCase.debtor || {};
      return {
        id: plain.id,
        debtCaseId: plain.debtCaseId,
        debtorName: debtor.fullName,
        debtorEmail: debtor.email,
        debtorPhone: debtor.phone,
        amountDueCents: debtCase.amountDueCents,
        daysPastDue: debtCase.daysPastDue,
        currency: debtCase.currency,
        currentStage: plain.currentStage ? { id: plain.currentStage.id, name: plain.currentStage.name } : null,
        nextActionAt: plain.nextActionAt,
        lastAttemptAt: plain.lastAttemptAt,
        lastOutcome: plain.lastOutcome,
        lastOutcomeAt: plain.lastOutcomeAt,
        status: plain.status,
        promiseDueDate: plain.promiseDueDate,
      };
    });

    return { data, total };
  },

  getActivity: async (tenantId, automationId, limit = 50) => {
    const automation = await automationRepository.findById(automationId, tenantId);
    if (!automation) throw new NotFoundError('Automation');

    const events = await automationRepository.findEvents(automationId, Math.min(limit, 100));
    return events.map((e) => {
      const plain = e.get ? e.get({ plain: true }) : e;
      return {
        id: plain.id,
        debtCaseId: plain.debtCaseId,
        channel: plain.channel,
        eventType: plain.eventType,
        payload: plain.payload,
        createdAt: plain.createdAt,
      };
    });
  },

  getAgreements: async (tenantId, automationId) => {
    const automation = await automationRepository.findById(automationId, tenantId);
    if (!automation) throw new NotFoundError('Automation');

    const agreements = await automationRepository.findAgreements(automationId, tenantId);
    return agreements.map((a) => {
      const plain = a.get ? a.get({ plain: true }) : a;
      const debtCase = plain.debtCase || {};
      const debtor = debtCase.debtor || {};
      return {
        id: plain.id,
        debtCaseId: plain.debtCaseId,
        type: plain.type,
        status: plain.status,
        totalAmountCents: plain.totalAmountCents,
        downPaymentCents: plain.downPaymentCents,
        installments: plain.installments,
        promiseDate: plain.promiseDate,
        startDate: plain.startDate,
        paymentLinkUrl: plain.paymentLinkUrl,
        createdAt: plain.createdAt,
        debtorName: debtor.fullName,
        debtorEmail: debtor.email,
        debtorPhone: debtor.phone,
        currency: debtCase.currency || 'USD',
      };
    });
  },

  enroll: async (tenantId, automationId, options = {}) => {
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant');

    const automation = await automationRepository.findById(automationId, tenantId);
    if (!automation) throw new NotFoundError('Automation');

    const strategy = automation.strategy;
    if (!strategy) throw new NotFoundError('Strategy');
    const stages = strategy.stages || [];
    if (stages.length === 0) {
      throw new ConflictError('Strategy has no stages; add stages before enrolling cases');
    }

    let debtCases;
    if (options.debtCaseIds && options.debtCaseIds.length > 0) {
      debtCases = await DebtCase.findAll({
        where: { id: { [Op.in]: options.debtCaseIds }, tenantId }, limit: 500,
      });
    } else {
      const alreadyEnrolled = await automationRepository.findEnrolledDebtCaseIds(automationId);
      debtCases = await DebtCase.findAll({
        where: {
          tenantId,
          status: { [Op.in]: ELIGIBLE_STATUSES },
          ...(alreadyEnrolled.length > 0 ? { id: { [Op.notIn]: alreadyEnrolled } } : {}),
        },
        limit: 1000,
      });
    }

    const now = new Date();
    let enrolled = 0;
    const errors = [];

    for (const dc of debtCases) {
      try {
        const existing = await CaseAutomationState.findOne({
          where: { debtCaseId: dc.id, automationId },
        });
        if (existing) {
          continue;
        }
        const stage = selectStageByDaysPastDue(stages, dc.daysPastDue ?? 0);
        if (!stage) continue;

        await CaseAutomationState.create({
          debtCaseId: dc.id,
          automationId,
          strategyId: automation.strategyId,
          currentStageId: stage.id,
          status: 'active',
          nextActionAt: now,
          attemptsWeekCount: 0,
          meta: {},
        });
        enrolled++;
      } catch (err) {
        errors.push({ debtCaseId: dc.id, message: err.message });
      }
    }

    return { enrolled, skipped: debtCases.length - enrolled - errors.length, total: debtCases.length, errors: errors.length ? errors : undefined };
  },

  /**
   * Recompute currentStageId for all enrolled cases based on debt case daysPastDue.
   * Use after build-cases updates DPD so stages (early/mid/late) match reality.
   */
  recomputeStagesForAutomation: async (tenantId, automationId) => {
    const automation = await automationRepository.findById(automationId, tenantId);
    if (!automation) throw new NotFoundError('Automation');
    const strategy = automation.strategy;
    const stages = strategy?.stages || [];
    if (stages.length === 0) return { updated: 0 };

    const states = await CaseAutomationState.findAll({
      where: { automationId },
      include: [{ model: DebtCase, as: 'debtCase', attributes: ['id', 'daysPastDue'], required: true }],
    });
    let updated = 0;
    for (const state of states) {
      const dpd = state.debtCase?.daysPastDue ?? 0;
      const stage = selectStageByDaysPastDue(stages, dpd);
      if (stage && stage.id !== state.currentStageId) {
        await state.update({ currentStageId: stage.id });
        updated++;
      }
    }
    return { updated };
  },
};
