import { caseRepository } from './case.repository.js';
import { tenantRepository } from '../tenants/tenant.repository.js';
import { NotFoundError } from '../../errors/index.js';

export const caseService = {
  getDetail: async (tenantId, debtCaseId) => {
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant');

    const debtCase = await caseRepository.findDebtCaseById(debtCaseId, tenantId);
    if (!debtCase) throw new NotFoundError('Case');

    const plain = debtCase.get ? debtCase.get({ plain: true }) : debtCase;
    return {
      id: plain.id,
      tenantId: plain.tenantId,
      debtorId: plain.debtorId,
      amountDueCents: plain.amountDueCents,
      currency: plain.currency,
      daysPastDue: plain.daysPastDue,
      dueDate: plain.dueDate,
      status: plain.status,
      lastContactedAt: plain.lastContactedAt,
      nextActionAt: plain.nextActionAt,
      closedAt: plain.closedAt,
      debtor: plain.debtor,
      automationStates: (plain.automationStates || []).map((s) => ({
        id: s.id,
        automationId: s.automationId,
        strategyId: s.strategyId,
        automation: s.automation,
        currentStage: s.currentStage,
        status: s.status,
        nextActionAt: s.nextActionAt,
        lastAttemptAt: s.lastAttemptAt,
        lastOutcome: s.lastOutcome,
        lastOutcomeAt: s.lastOutcomeAt,
        promiseDueDate: s.promiseDueDate,
        attemptsWeekCount: s.attemptsWeekCount,
      })),
    };
  },

  getTimeline: async (tenantId, debtCaseId, limit = 50) => {
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant');

    const debtCase = await caseRepository.findDebtCaseById(debtCaseId, tenantId);
    if (!debtCase) throw new NotFoundError('Case');

    const [events, logs] = await Promise.all([
      caseRepository.findEventsByDebtCaseId(debtCaseId, limit),
      caseRepository.findInteractionLogsByDebtCaseId(debtCaseId, limit),
    ]);

    const eventItems = events.map((e) => {
      const p = e.get ? e.get({ plain: true }) : e;
      return { type: 'collection_event', ...p };
    });
    const logItems = logs.map((l) => {
      const p = l.get ? l.get({ plain: true }) : l;
      return { type: 'interaction_log', ...p };
    });
    const combined = [...eventItems, ...logItems].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    return combined.slice(0, limit);
  },

  pause: async (tenantId, debtCaseId, automationId = null) => {
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant');

    const debtCase = await caseRepository.findDebtCaseById(debtCaseId, tenantId);
    if (!debtCase) throw new NotFoundError('Case');

    const states = debtCase.automationStates || [];
    const toPause = automationId ? states.filter((s) => s.automationId === automationId) : states;
    if (toPause.length === 0) {
      throw new NotFoundError(automationId ? 'Case automation state' : 'No automation state found for this case');
    }

    for (const s of toPause) {
      await caseRepository.updateCaseAutomationStateById(s.id, { status: 'paused' });
    }
    return { paused: true, count: toPause.length };
  },

  resume: async (tenantId, debtCaseId, automationId = null) => {
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant');

    const debtCase = await caseRepository.findDebtCaseById(debtCaseId, tenantId);
    if (!debtCase) throw new NotFoundError('Case');

    const states = debtCase.automationStates || [];
    const toResume = automationId ? states.filter((s) => s.automationId === automationId) : states;
    if (toResume.length === 0) {
      throw new NotFoundError(automationId ? 'Case automation state' : 'No automation state found for this case');
    }

    for (const s of toResume) {
      await caseRepository.updateCaseAutomationStateById(s.id, { status: 'active' });
    }
    return { resumed: true, count: toResume.length };
  },
};
