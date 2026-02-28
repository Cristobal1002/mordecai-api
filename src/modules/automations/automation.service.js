import { Op } from 'sequelize';
import { CaseAutomationState, PmsConnection, DebtCase, Debtor, CaseDispute, CollectionEvent, CollectionStage } from '../../models/index.js';
import { automationRepository } from './automation.repository.js';
import {
  addCaseActionJob,
  CASE_ACTION_JOB_TYPES,
} from '../../queues/case-actions.queue.js';
import { tenantRepository } from '../tenants/tenant.repository.js';
import { strategyRepository } from '../strategies/strategy.repository.js';
import { NotFoundError, ConflictError } from '../../errors/index.js';
import { logger } from '../../utils/logger.js';
import { resolveApprovalStatus } from '../cases/approval-resolver.service.js';

const ELIGIBLE_STATUSES = ['NEW', 'IN_PROGRESS', 'CONTACTED', 'PROMISE_TO_PAY', 'PAYMENT_PLAN', 'NO_ANSWER', 'REFUSED'];

const CHANNEL_ORDER = ['call', 'sms', 'email', 'whatsapp'];
const resolveDispatchChannels = (channels = {}) =>
  CHANNEL_ORDER.filter((channel) => channels[channel] === true);

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

  update: async (tenantId, automationId, data) => {
    const automation = await automationRepository.findById(automationId, tenantId);
    if (!automation) throw new NotFoundError('Automation');
    const updates = {};
    if (data.approvalMode != null) updates.approvalMode = data.approvalMode;
    if (data.approvalRules != null) updates.approvalRules = data.approvalRules;
    await automationRepository.update(automationId, tenantId, updates);
    return automationRepository.findById(automationId, tenantId);
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
      status: 'paused',
      pausedAt: new Date(),
      startedAt: null,
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
    const updates = {
      status: 'active',
      pausedAt: null,
      nextTickAt: new Date(),
    };
    if (!automation.startedAt) {
      updates.startedAt = new Date();
    }
    await automationRepository.update(automationId, tenantId, updates);
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

  getOverview: async (tenantId, automationId) => {
    const automation = await automationRepository.findById(automationId, tenantId);
    if (!automation) throw new NotFoundError('Automation');

    const { counts, stages } = await automationRepository.getOverviewData(automationId, tenantId);

    const events = await automationRepository.findEvents(automationId, 20, {
      include: [
        {
          model: DebtCase,
          as: 'debtCase',
          required: false,
          attributes: ['id', 'casePublicId'],
        },
      ],
    });

    const recentActivity = events.map((e) => {
      const plain = e.get ? e.get({ plain: true }) : e;
      const debtCase = plain.debtCase || {};
      return {
        id: plain.id,
        type: plain.eventType,
        at: plain.createdAt,
        caseId: plain.debtCaseId,
        casePublicId: debtCase.casePublicId ?? debtCase.case_public_id ?? null,
        actor: plain.payload?.actor ?? 'system',
        meta: plain.payload ?? {},
      };
    });

    const pms = automation.pmsConnection || {};
    const software = pms.software || {};

    return {
      automation: {
        id: automation.id,
        name: automation.strategy?.name ?? 'Automation',
        status: automation.status,
        source: software.key ?? 'unknown',
      },
      counts,
      stages,
      recentActivity,
    };
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

  getCases: async (tenantId, automationId, limit = 100, offset = 0, tab = null, filters = {}, sortBy = null, sortOrder = 'ASC') => {
    const automation = await automationRepository.findById(automationId, tenantId);
    if (!automation) throw new NotFoundError('Automation');

    const useFilters =
      (filters.status && filters.status.length > 0) ||
      (filters.stage && filters.stage.length > 0) ||
      filters.dpdMin != null ||
      filters.dpdMax != null ||
      filters.amountMinCents != null ||
      filters.amountMaxCents != null;
    if (tab === 'disputes' && !useFilters) {
      const enrolledIds = await automationRepository.findEnrolledDebtCaseIds(automationId);
      const rows = await automationRepository.findDisputesByAutomation(automationId, tenantId, {
        limit: Math.min(limit, 200),
        offset,
      });
      const total =
        enrolledIds.length === 0
          ? 0
          : await CaseDispute.count({
              where: {
                tenantId,
                status: 'OPEN',
                debtCaseId: { [Op.in]: enrolledIds },
              },
            });
      const data = rows.map((d) => {
        const plain = d.get ? d.get({ plain: true }) : d;
        const dc = plain.debtCase || {};
        const debtor = dc.debtor || {};
        const meta = dc.meta || {};
        const pmsLease = dc.pmsLease || {};
        const leaseNumber =
          meta.lease_number ?? meta.leaseNumber ?? pmsLease.leaseNumber ?? null;
        return {
          id: plain.id,
          debtCaseId: plain.debtCaseId,
          debtorName: debtor.fullName,
          debtorEmail: debtor.email,
          leaseNumber,
          amountDueCents: dc.amountDueCents,
          daysPastDue: dc.daysPastDue,
          reason: plain.reason,
          status: plain.status,
          openedAt: plain.openedAt,
        };
      });
      return { data, total };
    }

    const opts = {
      limit: Math.min(limit, 200),
      offset,
      tab: useFilters ? null : tab || undefined,
      filters: useFilters ? filters : undefined,
      sortBy,
      sortOrder,
    };
    const rows = await automationRepository.findCaseStates(automationId, opts);
    const total = await automationRepository.countCaseStates(automationId, {}, opts);

    const data = rows.map((s) => {
      const plain = s.get ? s.get({ plain: true }) : s;
      const debtCase = plain.debtCase || {};
      const debtor = debtCase.debtor || {};
      const meta = debtCase.meta || {};
      const pmsLease = debtCase.pmsLease || {};
      const leaseNumber =
        meta.lease_number ?? meta.leaseNumber ?? pmsLease.leaseNumber ?? null;
      return {
        id: plain.id,
        debtCaseId: plain.debtCaseId,
        debtorName: debtor.fullName,
        debtorEmail: debtor.email,
        debtorPhone: debtor.phone,
        amountDueCents: debtCase.amountDueCents,
        daysPastDue: debtCase.daysPastDue,
        currency: debtCase.currency,
        leaseNumber,
        pmsLeaseId: debtCase.pmsLeaseId ?? debtCase.pms_lease_id ?? null,
        approvalStatus: debtCase.approvalStatus ?? debtCase.approval_status,
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

  bulkApprove: async (tenantId, automationId, caseIds) => {
    const automation = await automationRepository.findById(automationId, tenantId);
    if (!automation) throw new NotFoundError('Automation');
    const enrolled = await automationRepository.findEnrolledDebtCaseIds(automationId);
    const valid = caseIds.filter((id) => enrolled.includes(id));
    const [count] = await DebtCase.update(
      { approvalStatus: 'APPROVED' },
      { where: { id: { [Op.in]: valid }, tenantId } }
    );
    return { approved: count };
  },

  bulkReject: async (tenantId, automationId, caseIds) => {
    const automation = await automationRepository.findById(automationId, tenantId);
    if (!automation) throw new NotFoundError('Automation');
    const enrolled = await automationRepository.findEnrolledDebtCaseIds(automationId);
    const valid = caseIds.filter((id) => enrolled.includes(id));
    const [count] = await DebtCase.update(
      { approvalStatus: 'REJECTED' },
      { where: { id: { [Op.in]: valid }, tenantId } }
    );
    await CaseAutomationState.update(
      { status: 'closed' },
      { where: { debtCaseId: { [Op.in]: valid }, automationId } }
    );
    return { rejected: count };
  },

  bulkExclude: async (tenantId, automationId, caseIds) => {
    const automation = await automationRepository.findById(automationId, tenantId);
    if (!automation) throw new NotFoundError('Automation');
    const enrolled = await automationRepository.findEnrolledDebtCaseIds(automationId);
    const valid = caseIds.filter((id) => enrolled.includes(id));
    const [count] = await DebtCase.update(
      { approvalStatus: 'EXCLUDED' },
      { where: { id: { [Op.in]: valid }, tenantId } }
    );
    await CaseAutomationState.update(
      { status: 'closed' },
      { where: { debtCaseId: { [Op.in]: valid }, automationId } }
    );
    return { excluded: count };
  },

  /**
   * Bulk action by filters (approve or exclude). Reuses same filter format as getCases.
   * Creates CollectionEvent for each affected case.
   */
  bulkByFilters: async (tenantId, automationId, action, filters = {}, options = {}) => {
    const automation = await automationRepository.findById(automationId, tenantId);
    if (!automation) throw new NotFoundError('Automation');

    const useFilters =
      (filters.status && filters.status.length > 0) ||
      (filters.stage && filters.stage.length > 0) ||
      filters.dpdMin != null ||
      filters.dpdMax != null ||
      filters.amountMinCents != null ||
      filters.amountMaxCents != null;

    const tab = useFilters ? null : action === 'approve' ? 'pending' : 'active';
    const opts = { limit: 5000, offset: 0, tab: useFilters ? null : tab, filters: useFilters ? filters : undefined };
    const rows = await automationRepository.findCaseStates(automationId, opts);
    const caseIds = rows.map((r) => r.debtCaseId ?? r.debt_case_id).filter(Boolean);

    if (caseIds.length === 0) return { affected: 0 };

    const actorId = options.actorId ?? null;
    const reason = options.reason ?? null;

    if (action === 'approve') {
      const enrolled = await automationRepository.findEnrolledDebtCaseIds(automationId);
      const valid = caseIds.filter((id) => enrolled.includes(id));
      const [count] = await DebtCase.update(
        { approvalStatus: 'APPROVED' },
        { where: { id: { [Op.in]: valid }, tenantId } }
      );
      for (const caseId of valid) {
        await CollectionEvent.create({
          automationId,
          debtCaseId: caseId,
          eventType: 'case_approved',
          payload: { actor: actorId ? 'user' : 'system', actorId, bulk: true },
        });
      }
      return { affected: count };
    }

    if (action === 'exclude') {
      const enrolled = await automationRepository.findEnrolledDebtCaseIds(automationId);
      const valid = caseIds.filter((id) => enrolled.includes(id));
      const [count] = await DebtCase.update(
        { approvalStatus: 'EXCLUDED' },
        { where: { id: { [Op.in]: valid }, tenantId } }
      );
      await CaseAutomationState.update(
        { status: 'closed' },
        { where: { debtCaseId: { [Op.in]: valid }, automationId } }
      );
      for (const caseId of valid) {
        await CollectionEvent.create({
          automationId,
          debtCaseId: caseId,
          eventType: 'case_excluded',
          payload: { actor: actorId ? 'user' : 'system', actorId, reason: reason ?? undefined, bulk: true },
        });
      }
      return { affected: count };
    }

    throw new ConflictError(`Unknown bulk action: ${action}`);
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
        where: { id: { [Op.in]: options.debtCaseIds }, tenantId },
        include: [{ model: Debtor, as: 'debtor', attributes: ['id', 'phone', 'email'] }],
        limit: 500,
      });
    } else {
      const alreadyEnrolled = await automationRepository.findEnrolledDebtCaseIds(automationId);
      debtCases = await DebtCase.findAll({
        where: {
          tenantId,
          status: { [Op.in]: ELIGIBLE_STATUSES },
          ...(alreadyEnrolled.length > 0 ? { id: { [Op.notIn]: alreadyEnrolled } } : {}),
        },
        include: [{ model: Debtor, as: 'debtor', attributes: ['id', 'phone', 'email'] }],
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

        const approvalStatus = resolveApprovalStatus(dc, automation, stage, dc.debtor);
        if (dc.approvalStatus !== approvalStatus) {
          await dc.update({ approvalStatus });
        }

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

  /**
   * Run the full strategy (call, SMS, email per current stage) for a single case on-demand.
   * Enqueues jobs for each enabled channel.
   */
  runStrategyForCase: async (tenantId, automationId, debtCaseId) => {
    const automation = await automationRepository.findById(automationId, tenantId);
    if (!automation) throw new NotFoundError('Automation');

    const state = await CaseAutomationState.findOne({
      where: { debtCaseId, automationId },
      include: [
        { model: DebtCase, as: 'debtCase', required: true, include: [{ model: Debtor, as: 'debtor', required: false }] },
        { model: CollectionStage, as: 'currentStage', required: false },
      ],
    });

    if (!state) throw new NotFoundError('Case is not enrolled in this automation');

    const approvalStatus = state.debtCase?.approvalStatus ?? state.debtCase?.approval_status;
    if (approvalStatus !== 'APPROVED') {
      throw new ConflictError('Case must be approved before running strategy');
    }

    const openDispute = await CaseDispute.findOne({
      where: { debtCaseId, status: 'OPEN' },
    });
    if (openDispute) {
      throw new ConflictError('Case has an open dispute; resolve it before running strategy');
    }

    const stage = state.currentStage || null;
    const dispatchChannels = resolveDispatchChannels(stage?.channels || {});

    if (dispatchChannels.length === 0) {
      return {
        message: 'No channel enabled in current stage',
        queued: [],
      };
    }

    const now = new Date();
    const outcomes = [];

    for (const channel of dispatchChannels) {
      if (channel === 'call') {
        const jobId = await addCaseActionJob(CASE_ACTION_JOB_TYPES.CALL_CASE, {
          tenantId: automation.tenantId,
          caseId: state.debtCaseId,
          automationId: automation.id,
          stateId: state.id,
        });
        if (jobId) {
          outcomes.push('call_queued');
          await CollectionEvent.create({
            automationId,
            debtCaseId: state.debtCaseId,
            channel: 'call',
            eventType: 'call_queued',
            payload: { jobId },
          });
        } else {
          outcomes.push('call_dispatch_queue_unavailable');
        }
        continue;
      }
      if (channel === 'sms') {
        const jobId = await addCaseActionJob(CASE_ACTION_JOB_TYPES.SMS_CASE, {
          tenantId: automation.tenantId,
          caseId: state.debtCaseId,
          automationId: automation.id,
          stateId: state.id,
        });
        if (jobId) {
          outcomes.push('sms_queued');
          await CollectionEvent.create({
            automationId,
            debtCaseId: state.debtCaseId,
            channel: 'sms',
            eventType: 'sms_queued',
            payload: { jobId },
          });
        } else {
          outcomes.push('sms_dispatch_queue_unavailable');
        }
        continue;
      }
      if (channel === 'email') {
        const jobId = await addCaseActionJob(CASE_ACTION_JOB_TYPES.EMAIL_CASE, {
          tenantId: automation.tenantId,
          caseId: state.debtCaseId,
          automationId: automation.id,
          stateId: state.id,
        });
        if (jobId) {
          outcomes.push('email_queued');
          await CollectionEvent.create({
            automationId,
            debtCaseId: state.debtCaseId,
            channel: 'email',
            eventType: 'email_queued',
            payload: { jobId },
          });
        } else {
          outcomes.push('email_dispatch_queue_unavailable');
        }
        continue;
      }
    }

    const outcome = outcomes.length > 0 ? outcomes.join(',') : 'dispatch_skipped_no_channel';
    await state.update({
      lastAttemptAt: now,
      nextActionAt: now,
      attemptsWeekCount: (state.attemptsWeekCount ?? 0) + 1,
      lastOutcome: outcome,
      lastOutcomeAt: now,
    });

    return {
      message: `Strategy executed: ${outcomes.filter((o) => o.endsWith('_queued')).length} channel(s) queued`,
      queued: outcomes.filter((o) => o.endsWith('_queued')),
    };
  },
};
