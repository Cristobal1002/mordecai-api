-- Migration: Add trigger and idempotency_key to sync_runs
-- Description: Source of sync (manual|scheduled|webhook) and idempotency; only one active sync per connection enforced in API

ALTER TABLE sync_runs
  ADD COLUMN IF NOT EXISTS trigger VARCHAR(32) DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(256);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_runs_idempotency
  ON sync_runs(pms_connection_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Only one pending/running sync per connection (enforced at DB level)
CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_runs_one_active_per_connection
  ON sync_runs(pms_connection_id)
  WHERE status IN ('pending', 'running');

COMMENT ON COLUMN sync_runs.trigger IS 'manual | scheduled | webhook';
COMMENT ON COLUMN sync_runs.idempotency_key IS 'Optional: connectionId + trigger + timestamp or job id for dedupe';
