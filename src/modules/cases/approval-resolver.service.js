/**
 * Resolves approval_status when enrolling a case in an automation.
 * Used for HYBRID mode: auto-approve low-risk, require approval for sensitive.
 */
export const APPROVAL_STATUSES = ['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'EXCLUDED'];

/**
 * Determine initial approval_status for a case when enrolling in an automation.
 * @param {object} debtCase - DebtCase instance (needs amountDueCents, daysPastDue)
 * @param {object} automation - CollectionAutomation with approvalMode and approvalRules
 * @param {object} [stage] - Current stage (for "Special" or stage-based rules)
 * @param {object} [debtor] - Debtor for contact check (phone, email)
 * @returns {'APPROVED'|'PENDING_APPROVAL'}
 */
export function resolveApprovalStatus(debtCase, automation, stage = null, debtor = null) {
  const mode = automation.approvalMode || automation.get?.('approvalMode') || 'AUTO';
  const rules = automation.approvalRules || automation.get?.('approvalRules') || {};

  if (mode === 'AUTO') return 'APPROVED';
  if (mode === 'REQUIRE_APPROVAL') return 'PENDING_APPROVAL';

  if (mode === 'HYBRID') {
    const dpd = Number(debtCase.daysPastDue ?? debtCase.get?.('daysPastDue') ?? 0);
    const amountCents = Number(debtCase.amountDueCents ?? debtCase.get?.('amountDueCents') ?? 0);

    // Require approval if rules say so
    const maxDpd = rules.autoApproveMaxDpd;
    if (maxDpd != null && dpd > maxDpd) return 'PENDING_APPROVAL';

    const maxAmountCents = rules.autoApproveMaxAmountCents;
    if (maxAmountCents != null && amountCents > maxAmountCents) return 'PENDING_APPROVAL';

    const requireApprovalStages = rules.requireApprovalStages || [];
    const stageName = (stage?.name ?? stage?.get?.('name') ?? '').toLowerCase();
    if (requireApprovalStages.some((s) => String(s).toLowerCase() === stageName)) {
      return 'PENDING_APPROVAL';
    }

    if (rules.requireApprovalMissingContact && debtor) {
      const hasPhone = !!(debtor.phone ?? debtor.get?.('phone'));
      const hasEmail = !!(debtor.email ?? debtor.get?.('email'));
      if (!hasPhone && !hasEmail) return 'PENDING_APPROVAL';
    }

    return 'APPROVED';
  }

  return 'APPROVED';
}
