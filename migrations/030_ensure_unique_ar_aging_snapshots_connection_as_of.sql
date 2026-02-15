-- Migration: Ensure unique (pms_connection_id, as_of_date) on ar_aging_snapshots
-- Description: Required for ArAgingSnapshot.upsert ON CONFLICT. If the table was created by
--              Sequelize sync or the constraint was never applied, this adds it.

-- If table was created by Sequelize sync, constraint may be named uq_ar_aging_snapshots_connection_date
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'ar_aging_snapshots'::regclass
      AND conname IN ('uq_ar_aging_snapshots_connection_as_of', 'uq_ar_aging_snapshots_connection_date')
      AND contype = 'u'
  ) THEN
    ALTER TABLE ar_aging_snapshots
      ADD CONSTRAINT uq_ar_aging_snapshots_connection_as_of UNIQUE (pms_connection_id, as_of_date);
  END IF;
END $$;
