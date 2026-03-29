/**
 * Collection tick queue: recurring job to run collection engine tick.
 * Worker (mordecai-workers) consumes and runs runCollectionTick().
 */
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from '../utils/logger.js';
import { withBullmqPrefix } from './bullmq-queue-options.js';

export const COLLECTION_TICK_QUEUE_NAME = 'collection-tick';

let connection = null;
let queue = null;

function getConnection() {
  if (connection) return connection;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  connection = new IORedis(url, { maxRetriesPerRequest: null });
  connection.on('error', (err) => logger.error({ err }, 'Collection tick queue Redis error'));
  return connection;
}

export function getCollectionTickQueue() {
  if (queue) return queue;
  const conn = getConnection();
  if (!conn) return null;
  queue = new Queue(
    COLLECTION_TICK_QUEUE_NAME,
    withBullmqPrefix({ connection: conn })
  );
  return queue;
}

const TICK_INTERVAL_MS = 15 * 60 * 1000; // 15 min

/**
 * Schedule the repeatable tick job. Call from worker on startup.
 * Idempotent: use jobId to avoid duplicates.
 */
export async function scheduleCollectionTick() {
  const q = getCollectionTickQueue();
  if (!q) return null;
  const repeatable = await q.add(
    'tick',
    {},
    {
      jobId: 'collection-tick-recurring',
      repeat: { every: TICK_INTERVAL_MS },
    }
  );
  logger.info({ every: TICK_INTERVAL_MS }, 'Collection tick repeatable job scheduled');
  return repeatable;
}
