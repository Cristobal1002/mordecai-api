/**
 * Automation Daily Full Sync: debtors + leases (catalog).
 * Per AUTOMATION_HOURLY_MAINTENANCE.md. Runs every 24h per connection.
 * Skips connection if lock cannot be acquired.
 */
import { PmsConnection } from '../../models/index.js';
import { runSync } from '../property-managers/sync/sync-runner.service.js';
import { acquireLock, releaseLock } from '../../utils/pms-sync-lock.js';
import { logger } from '../../utils/logger.js';

const DAILY_SYNC_STEPS = ['debtors_leases'];

/**
 * Run daily full sync (debtors/leases) for a single connection.
 */
export async function runDailyFullSyncForConnection(tenantId, connectionId) {
  const acquired = await acquireLock(tenantId, connectionId);
  if (!acquired) {
    logger.info({ tenantId, connectionId }, 'Daily full sync: skip (lock held)');
    return { skipped: true, reason: 'lock_held' };
  }

  try {
    await runSync(connectionId, {
      trigger: 'scheduled',
      steps: DAILY_SYNC_STEPS,
    });
    return { skipped: false };
  } catch (err) {
    logger.error({ err, tenantId, connectionId }, 'Daily full sync: failed');
    throw err;
  } finally {
    await releaseLock(tenantId, connectionId);
  }
}

/**
 * Run daily full sync for all connected PMS connections.
 */
export async function runDailyFullSync() {
  const connections = await PmsConnection.findAll({
    where: { status: 'connected' },
    attributes: ['id', 'tenantId'],
  });

  if (connections.length === 0) {
    logger.debug('Daily full sync: no connected connections');
    return { processed: 0, skipped: 0, total: 0 };
  }

  let processed = 0;
  let skipped = 0;

  for (const conn of connections) {
    const tenantId = conn.tenantId;
    const connectionId = conn.id;
    try {
      const result = await runDailyFullSyncForConnection(tenantId, connectionId);
      if (result.skipped) {
        skipped++;
      } else {
        processed++;
      }
    } catch (err) {
      logger.error({ err, tenantId, connectionId }, 'Daily full sync: connection failed');
      await releaseLock(tenantId, connectionId).catch(() => {});
    }
  }

  logger.info({ processed, skipped, total: connections.length }, 'Daily full sync completed');

  return {
    processed,
    skipped,
    total: connections.length,
  };
}
