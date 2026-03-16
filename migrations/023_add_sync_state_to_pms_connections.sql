-- Migration: Add sync_state to pms_connections for incremental control
-- Description: Cursors (debtorsSince, leasesSince, etc.) and last run timestamps

ALTER TABLE pms_connections
  ADD COLUMN IF NOT EXISTS sync_state JSONB DEFAULT '{}';

COMMENT ON COLUMN pms_connections.sync_state IS 'Incremental sync cursors and run metadata: debtorsSince, leasesSince, chargesSince, paymentsSince, lastSuccessfulRunAt, lastAttemptAt';
