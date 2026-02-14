-- Migration: Add open_amount_cents to ar_charges (PMS-provided balance per charge)
-- Description: When the PMS returns open/balance per charge, store it for accurate aging

ALTER TABLE ar_charges
  ADD COLUMN IF NOT EXISTS open_amount_cents BIGINT;

COMMENT ON COLUMN ar_charges.open_amount_cents IS 'Remaining balance for this charge from PMS; null if not provided (we derive from payments)';
