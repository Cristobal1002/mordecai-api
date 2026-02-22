/**
 * Case actions queue: on-demand call jobs. Requires REDIS_URL.
 * Worker (mordecai-workers) processes CALL_CASE jobs.
 */
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from '../utils/logger.js';

export const CASE_ACTIONS_QUEUE_NAME = 'case-actions';
export const JOB_TYPES = { CALL_CASE: 'CALL_CASE' };

let connection = null;
let queue = null;

function getConnection() {
  if (connection) return connection;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  connection = new IORedis(url, { maxRetriesPerRequest: null });
  connection.on('error', (err) => logger.error({ err }, 'Case actions queue Redis error'));
  return connection;
}

export function getCaseActionsQueue() {
  if (queue) return queue;
  const conn = getConnection();
  if (!conn) return null;
  queue = new Queue(CASE_ACTIONS_QUEUE_NAME, { connection: conn });
  return queue;
}

/**
 * Enqueue an on-demand call for a debt case. Returns job id or null if queue not available.
 * @param {string} tenantId
 * @param {string} caseId - debt_case id
 */
export async function addCallCaseJob(tenantId, caseId) {
  const q = getCaseActionsQueue();
  if (!q) return null;
  const jobId = `CALL_CASE-on-demand-${caseId}-${Date.now()}`;
  const job = await q.add(
    JOB_TYPES.CALL_CASE,
    { tenantId, caseId },
    {
      jobId,
      attempts: Number(process.env.WORKER_ATTEMPTS) || 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    }
  );
  logger.info({ tenantId, caseId, jobId: job.id }, 'On-demand call job enqueued');
  return job.id;
}
