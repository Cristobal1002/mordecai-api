import { sequelize } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { caseActionsQueue, JOB_TYPES } from '../queues/case-actions.queue.js';

const DEFAULT_LIMIT = 500;
const DEFAULT_COOLDOWN_MINUTES = 360;

const buildTenantClause = (tenantId, replacements) => {
  if (!tenantId) {
    return '';
  }

  replacements.tenantId = tenantId;
  return 'AND dc.tenant_id = :tenantId';
};

export const listDueCallCases = async ({ tenantId, limit = DEFAULT_LIMIT } = {}) => {
  if (!sequelize) {
    throw new Error('Database connection is not initialized.');
  }

  const replacements = { limit };
  const tenantClause = buildTenantClause(tenantId, replacements);

  const sql = `
    SELECT dc.id, dc.tenant_id
    FROM debt_cases dc
    JOIN flow_policies fp ON fp.id = dc.flow_policy_id
    WHERE dc.status IN ('NEW','IN_PROGRESS')
      AND (dc.next_action_at IS NULL OR dc.next_action_at <= NOW())
      ${tenantClause}
      AND COALESCE((fp.channels->>'call')::boolean, false) = true
    ORDER BY dc.next_action_at NULLS FIRST, dc.created_at
    LIMIT :limit;
  `;

  const [rows] = await sequelize.query(sql, { replacements });
  return rows || [];
};

const claimDueCallCases = async ({
  tenantId,
  limit = DEFAULT_LIMIT,
  cooldownMinutes = DEFAULT_COOLDOWN_MINUTES,
  transaction,
} = {}) => {
  if (!sequelize) {
    throw new Error('Database connection is not initialized.');
  }

  const replacements = { limit, cooldownMinutes };
  const tenantClause = buildTenantClause(tenantId, replacements);

  const sql = `
    WITH due AS (
      SELECT dc.id
      FROM debt_cases dc
      JOIN flow_policies fp ON fp.id = dc.flow_policy_id
      WHERE dc.status IN ('NEW','IN_PROGRESS')
        AND (dc.next_action_at IS NULL OR dc.next_action_at <= NOW())
        ${tenantClause}
        AND COALESCE((fp.channels->>'call')::boolean, false) = true
      ORDER BY dc.next_action_at NULLS FIRST, dc.created_at
      LIMIT :limit
      FOR UPDATE SKIP LOCKED
    )
    UPDATE debt_cases dc
    SET next_action_at = NOW() + (:cooldownMinutes || ' minutes')::interval
    FROM due
    WHERE dc.id = due.id
    RETURNING dc.id, dc.tenant_id;
  `;

  const [rows] = await sequelize.query(sql, {
    replacements,
    transaction,
  });

  return rows || [];
};

export const scheduleDueCallCases = async ({
  tenantId,
  limit = DEFAULT_LIMIT,
  cooldownMinutes = DEFAULT_COOLDOWN_MINUTES,
  dryRun = false,
} = {}) => {
  if (dryRun) {
    const rows = await listDueCallCases({ tenantId, limit });
    return {
      dryRun: true,
      queued: 0,
      found: rows.length,
      cases: rows,
    };
  }

  const result = await sequelize.transaction(async (transaction) => {
    const rows = await claimDueCallCases({
      tenantId,
      limit,
      cooldownMinutes,
      transaction,
    });

    return rows;
  });

  let queued = 0;
  for (const row of result) {
    try {
      await caseActionsQueue.add(
        JOB_TYPES.CALL_CASE,
        { tenantId: row.tenant_id, caseId: row.id },
        {
          jobId: `${JOB_TYPES.CALL_CASE}-${row.id}`,
          attempts: Number(process.env.WORKER_ATTEMPTS) || 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        }
      );
      queued += 1;
    } catch (error) {
      logger.error(
        { err: error, caseId: row.id },
        'Failed to enqueue case action job'
      );
    }
  }

  return {
    dryRun: false,
    queued,
    found: result.length,
  };
};
