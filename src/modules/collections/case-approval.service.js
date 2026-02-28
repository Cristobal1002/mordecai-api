/**
 * Case approval and dispute helpers.
 * Used by collection-tick, worker. Approval resolution for enroll is in cases/approval-resolver.service.js
 */
import { CaseDispute } from '../../models/index.js';

/**
 * Check if a debt case has an open dispute. Used to skip execution.
 * @param {string} debtCaseId
 * @returns {Promise<boolean>}
 */
export async function hasOpenDisputeForCase(debtCaseId) {
  const count = await CaseDispute.count({
    where: { debtCaseId, status: 'OPEN' },
  });
  return count > 0;
}
