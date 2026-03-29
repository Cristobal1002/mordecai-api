/**
 * Automation maintenance queue: hourly (payments+balances, refresh, build) and daily (debtors/leases).
 * Worker (mordecai-workers) processes jobs.
 */
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from '../utils/logger.js';
import { withBullmqPrefix } from './bullmq-queue-options.js';

export const AUTOMATION_MAINTENANCE_QUEUE_NAME = 'automation-maintenance';

let connection = null;
let queue = null;

function getConnection() {
  if (connection) return connection;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  connection = new IORedis(url, { maxRetriesPerRequest: null });
  connection.on('error', (err) => logger.error({ err }, 'Automation maintenance queue Redis error'));
  return connection;
}

export function getAutomationMaintenanceQueue() {
  if (queue) return queue;
  const conn = getConnection();
  if (!conn) return null;
  queue = new Queue(
    AUTOMATION_MAINTENANCE_QUEUE_NAME,
    withBullmqPrefix({ connection: conn })
  );
  return queue;
}
