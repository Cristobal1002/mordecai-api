/**
 * Automation Hourly Maintenance: sync (payments + balances) → refresh → build.
 * Per AUTOMATION_HOURLY_MAINTENANCE.md. Runs every 60 min per connection.
 * Skips connection if lock cannot be acquired (manual sync in progress).
 */
import { PmsConnection } from '../../models/index.js';
import { runSync } from '../property-managers/sync/sync-runner.service.js';
import { refreshCasesFromPms } from '../property-managers/case-refresh.service.js';
import { buildNewCasesFromPms } from '../property-managers/case-build.service.js';
import { acquireLock, releaseLock } from '../../utils/pms-sync-lock.js';
import { logger } from '../../utils/logger.js';

const HOURLY_SYNC_STEPS = ['payments', 'balances_aging'];

/**
 * Run hourly maintenance for a single connection.
 * Returns { skipped: true } if lock not acquired, else stats.
 */
export async function runHourlyMaintenanceForConnection(tenantId, connectionId) {
  const acquired = await acquireLock(tenantId, connectionId);
  if (!acquired) {
    logger.info({ tenantId, connectionId }, 'Hourly maintenance: skip (lock held)');
    return { skipped: true, reason: 'lock_held' };
  }

  try {
    await runSync(connectionId, {
      trigger: 'scheduled',
      steps: HOURLY_SYNC_STEPS,
    });
    const refreshResult = await refreshCasesFromPms(tenantId, connectionId);
    const buildResult = await buildNewCasesFromPms(tenantId, connectionId);

    return {
      skipped: false,
      updated: refreshResult.updated ?? 0,
      resolved: refreshResult.resolved ?? 0,
      newCases: buildResult.created ?? 0,
    };
  } catch (err) {
    logger.error({ err, tenantId, connectionId }, 'Hourly maintenance: failed');
    throw err;
  } finally {
    await releaseLock(tenantId, connectionId);
  }
}

/**
 * Run hourly maintenance for all connected PMS connections.
 */
export async function runHourlyMaintenance() {
  const connections = await PmsConnection.findAll({
    where: { status: 'connected' },
    attributes: ['id', 'tenantId', 'syncState'],
  });

  if (connections.length === 0) {
    logger.debug('Hourly maintenance: no connected connections');
    return { processed: 0, skipped: 0, total: 0 };
  }

  let processed = 0;
  let skipped = 0;
  const results = [];

  for (const conn of connections) {
    const tenantId = conn.tenantId;
    const connectionId = conn.id;
    try {
      const result = await runHourlyMaintenanceForConnection(tenantId, connectionId);
      if (result.skipped) {
        skipped++;
      } else {
        processed++;
        results.push({ connectionId, tenantId, ...result });
      }
    } catch (err) {
      logger.error({ err, tenantId, connectionId }, 'Hourly maintenance: connection failed');
      await releaseLock(tenantId, connectionId).catch(() => {});
    }
  }

  logger.info(
    { processed, skipped, total: connections.length, results },
    'Hourly maintenance completed'
  );

  return {
    processed,
    skipped,
    total: connections.length,
    results,
  };
}
