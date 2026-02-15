-- Migration: Ensure unique (pms_lease_id, as_of_date) on ar_balances
-- Description: Required for ArBalance.upsert ON CONFLICT. If the table was created by
--              Sequelize sync or the constraint was never applied, this adds it.

-- If table was created by Sequelize sync, constraint may be named uq_ar_balances_lease_as_of_date
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'ar_balances'::regclass
      AND conname IN ('uq_ar_balances_lease_as_of', 'uq_ar_balances_lease_as_of_date')
      AND contype = 'u'
  ) THEN
    ALTER TABLE ar_balances
      ADD CONSTRAINT uq_ar_balances_lease_as_of UNIQUE (pms_lease_id, as_of_date);
  END IF;
END $$;
