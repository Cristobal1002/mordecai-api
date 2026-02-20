/**
 * Case actions queue shared with mordecai-workers.
 * Used to enqueue outbound call actions from collections engine.
 */
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from '../utils/logger.js';

export const CASE_ACTIONS_QUEUE_NAME = 'case-actions';

export const CASE_ACTION_JOB_TYPES = {
  CALL_CASE: 'CALL_CASE',
  SMS_CASE: 'SMS_CASE',
  SYNC_CALL_SUMMARY: 'SYNC_CALL_SUMMARY',
};

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

export async function addCaseActionJob(jobName, data, options = {}) {
  const q = getCaseActionsQueue();
  if (!q) return null;

  const job = await q.add(jobName, data, {
    attempts: Number(process.env.WORKER_ATTEMPTS) || 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
    ...options,
  });

  return job.id;
}
