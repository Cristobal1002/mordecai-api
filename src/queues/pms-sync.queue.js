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

/**
 * Enqueue a sync job for the given connection. Returns job id or null if queue not available.
 * @param {string} connectionId
 * @param {string} tenantId
 * @param {{ trigger?: 'manual'|'scheduled'|'webhook' }} [options]
 */
export async function addPmsSyncJob(connectionId, tenantId, options = {}) {
  const q = getPmsSyncQueue();
  if (!q) return null;
  const trigger = options.trigger ?? 'manual';
  const job = await q.add(
    'sync',
    { connectionId, tenantId, trigger },
    { attempts: 2, backoff: { type: 'exponential', delay: 5000 } }
  );
  logger.info({ connectionId, tenantId, trigger, jobId: job.id }, 'PMS sync job enqueued');
  return job.id;
}
