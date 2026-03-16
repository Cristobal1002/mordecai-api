/**
 * Redis lock for PMS sync operations. Prevents concurrent sync/refresh/build for same tenant+connection.
 * Uses SET key NX EX for atomic acquire. Lock is released on job completion or after TTL.
 */
import { getPmsSyncRedis } from '../queues/pms-sync.queue.js';
import { logger } from './logger.js';

const LOCK_PREFIX = 'pms-sync:lock:';
const LOCK_TTL_SECONDS = 600; // 10 min - safety if worker crashes

export function lockKey(tenantId, connectionId) {
  return `${LOCK_PREFIX}${tenantId}:${connectionId}`;
}

/**
 * Acquire lock. Returns true if acquired, false if already locked.
 */
export async function acquireLock(tenantId, connectionId) {
  const redis = getPmsSyncRedis();
  if (!redis) return true; // No Redis = no lock, allow (queue won't work anyway)
  const key = lockKey(tenantId, connectionId);
  try {
    const result = await redis.set(key, '1', 'EX', LOCK_TTL_SECONDS, 'NX');
    return result === 'OK';
  } catch (err) {
    logger.warn({ err, tenantId, connectionId }, 'PMS sync lock acquire failed');
    return false; // Fail closed - don't allow if we can't verify lock
  }
}

/**
 * Release lock so another sync can run.
 */
export async function releaseLock(tenantId, connectionId) {
  const redis = getPmsSyncRedis();
  if (!redis) return;
  const key = lockKey(tenantId, connectionId);
  try {
    await redis.del(key);
  } catch (err) {
    logger.warn({ err, tenantId, connectionId }, 'PMS sync lock release failed');
  }
}
