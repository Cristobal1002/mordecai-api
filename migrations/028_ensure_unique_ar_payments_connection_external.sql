-- Migration: Ensure unique (pms_connection_id, external_id) on ar_payments
-- Description: Required for ArPayment.upsert ON CONFLICT. If the table was created by
--              Sequelize sync or the constraint was never applied, this adds it.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_ar_payments_connection_external'
  ) THEN
    ALTER TABLE ar_payments
      ADD CONSTRAINT uq_ar_payments_connection_external UNIQUE (pms_connection_id, external_id);
  END IF;
END $$;
