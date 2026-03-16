import { CaseDispute, DebtCase } from '../../models/index.js';
import { tenantRepository } from '../tenants/tenant.repository.js';
import { caseRepository } from '../cases/case.repository.js';
import { NotFoundError, ConflictError } from '../../errors/index.js';

const DISPUTE_REASONS = [
  'PAID_ALREADY',
  'WRONG_AMOUNT',
  'WRONG_DEBTOR',
  'LEASE_ENDED',
  'UNDER_LEGAL_REVIEW',
  'PROMISE_OFFLINE',
  'DO_NOT_CONTACT',
  'OTHER',
];

export const disputeService = {
  create: async (tenantId, debtCaseId, { reason, notes, evidenceUrls = [] }, openedBy = null) => {
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant');

    const debtCase = await caseRepository.findDebtCaseById(debtCaseId, tenantId);
    if (!debtCase) throw new NotFoundError('Case');

    if (!DISPUTE_REASONS.includes(reason)) {
      throw new ConflictError(`Invalid reason. Must be one of: ${DISPUTE_REASONS.join(', ')}`);
    }

    const existing = await CaseDispute.findOne({
      where: { debtCaseId, status: 'OPEN' },
    });
    if (existing) {
      throw new ConflictError('This case already has an open dispute');
    }

    const dispute = await CaseDispute.create({
      debtCaseId,
      tenantId,
      status: 'OPEN',
      reason,
      notes: notes || null,
      evidenceUrls: Array.isArray(evidenceUrls) ? evidenceUrls : [],
      openedBy: openedBy || null,
      openedAt: new Date(),
    });

    const plain = dispute.get ? dispute.get({ plain: true }) : dispute;
    return {
      id: plain.id,
      debtCaseId: plain.debtCaseId,
      status: plain.status,
      reason: plain.reason,
      notes: plain.notes,
      openedAt: plain.openedAt,
    };
  },

  resolve: async (tenantId, disputeId, { resolution }, resolvedBy = null) => {
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant');

    const dispute = await CaseDispute.findOne({
      where: { id: disputeId, tenantId },
    });
    if (!dispute) throw new NotFoundError('Dispute');
    if (dispute.status !== 'OPEN') {
      throw new ConflictError('Dispute is not open. Only open disputes can be resolved.');
    }

    await dispute.update({
      status: 'RESOLVED',
      resolvedBy: resolvedBy || null,
      resolvedAt: new Date(),
      resolution: resolution || null,
    });

    const plain = dispute.get ? dispute.get({ plain: true }) : dispute;
    return {
      id: plain.id,
      status: plain.status,
      resolution: plain.resolution,
      resolvedAt: plain.resolvedAt,
    };
  },

  listReasons: () => DISPUTE_REASONS,
};
