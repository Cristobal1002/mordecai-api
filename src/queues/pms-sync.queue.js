/**
 * PMS sync queue: on-demand sync jobs. Requires REDIS_URL.
 */
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from '../utils/logger.js';

export const PMS_SYNC_QUEUE_NAME = 'pms-sync';

let connection = null;
let queue = null;

function getConnection() {
  if (connection) return connection;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  connection = new IORedis(url, { maxRetriesPerRequest: null });
  connection.on('error', (err) => logger.error({ err }, 'PMS sync queue Redis error'));
  return connection;
}

/**
 * Get the PMS sync queue (lazy init). Returns null if REDIS_URL is not set.
 */
export function getPmsSyncQueue() {
  if (queue) return queue;
  const conn = getConnection();
  if (!conn) return null;
  queue = new Queue(PMS_SYNC_QUEUE_NAME, { connection: conn });
  return queue;
}

/** Allowed step names for partial sync. */
export const PMS_SYNC_STEPS = ['debtors_leases', 'charges', 'payments', 'balances_aging'];

/**
 * Enqueue a sync job for the given connection. Returns job id or null if queue not available.
 * @param {string} connectionId
 * @param {string} tenantId
 * @param {{ trigger?: 'manual'|'scheduled'|'webhook', steps?: string[] }} [options]
 *   steps: if set, only these steps run (e.g. ['debtors_leases'] for leases only); otherwise full sync.
 */
export async function addPmsSyncJob(connectionId, tenantId, options = {}) {
  const q = getPmsSyncQueue();
  if (!q) return null;
  const trigger = options.trigger ?? 'manual';
  const steps = options.steps ?? null;
  const job = await q.add(
    'sync',
    { connectionId, tenantId, trigger, steps },
    { attempts: 2, backoff: { type: 'exponential', delay: 5000 } }
  );
  logger.info({ connectionId, tenantId, trigger, steps, jobId: job.id }, 'PMS sync job enqueued');
  return job.id;
}

/**
 * Enqueue a build-cases job (debt cases from PMS balances). Returns job id or null if queue not available.
 */
export async function addBuildCasesJob(connectionId, tenantId) {
  const q = getPmsSyncQueue();
  if (!q) return null;
  const job = await q.add(
    'build-cases',
    { connectionId, tenantId },
    { attempts: 2, backoff: { type: 'exponential', delay: 5000 } }
  );
  logger.info({ connectionId, tenantId, jobId: job.id }, 'Build cases job enqueued');
  return job.id;
}

/**
 * Get job by id. Returns null if queue unavailable or job not found.
 */
export async function getJobById(jobId) {
  const q = getPmsSyncQueue();
  if (!q) return null;
  return q.getJob(jobId);
}

/**
 * Get job status for build-cases or sync. Returns null if queue unavailable or job not found.
 */
export async function getJobStatus(jobId) {
  const job = await getJobById(jobId);
  if (!job) return null;
  const state = await job.getState();
  return {
    status: state,
    result: job.returnvalue ?? null,
    failedReason: job.failedReason ?? null,
  };
}
