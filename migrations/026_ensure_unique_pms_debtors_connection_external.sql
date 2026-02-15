-- Migration: Ensure unique (pms_connection_id, external_id) on pms_debtors
-- Description: Required for upsert ON CONFLICT. If the table was created by Sequelize sync
--              without running 013, this constraint may be missing.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_pms_debtors_connection_external'
  ) THEN
    ALTER TABLE pms_debtors
      ADD CONSTRAINT uq_pms_debtors_connection_external UNIQUE (pms_connection_id, external_id);
  END IF;
END $$;
