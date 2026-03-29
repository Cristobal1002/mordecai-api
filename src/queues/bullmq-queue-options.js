/**
 * Optional Redis key prefix for all BullMQ queues/workers.
 * When you share one Redis (e.g. Upstash) between local dev and deployed workers,
 * another consumer can grab SMS_CASE jobs first — set the same BULLMQ_PREFIX in API + workers .env
 * so only matching processes share queues (e.g. BULLMQ_PREFIX=local-yourname).
 */
export function getBullmqPrefix() {
  const p = process.env.BULLMQ_PREFIX?.trim();
  return p || undefined;
}

/** Merge BullMQ options with optional prefix (API + workers must use the same value). */
export function withBullmqPrefix(opts) {
  const prefix = getBullmqPrefix();
  if (!prefix) return opts;
  return { ...opts, prefix };
}
