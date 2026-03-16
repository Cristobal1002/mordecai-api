-- Migration: Align case_disputes enum names with Sequelize
-- Sequelize expects enum_case_disputes_status and enum_case_disputes_reason
-- The previous migration created case_dispute_status and case_dispute_reason
-- PostgreSQL cannot cast between different enum types, so we migrate via text

DO $$ BEGIN
  CREATE TYPE enum_case_disputes_status AS ENUM ('OPEN', 'WAITING_TENANT', 'WAITING_DEBTOR', 'RESOLVED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE enum_case_disputes_reason AS ENUM (
    'PAID_ALREADY', 'WRONG_AMOUNT', 'WRONG_DEBTOR', 'LEASE_ENDED',
    'UNDER_LEGAL_REVIEW', 'PROMISE_OFFLINE', 'DO_NOT_CONTACT', 'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Migrate status column if it uses old enum
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'case_disputes' AND column_name = 'status'
      AND udt_name = 'case_dispute_status'
  ) THEN
    DROP INDEX IF EXISTS idx_case_disputes_one_open_per_case;
    ALTER TABLE case_disputes ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE case_disputes ALTER COLUMN status TYPE enum_case_disputes_status USING ((status::text)::enum_case_disputes_status);
    ALTER TABLE case_disputes ALTER COLUMN status SET DEFAULT 'OPEN'::enum_case_disputes_status;
    CREATE UNIQUE INDEX idx_case_disputes_one_open_per_case ON case_disputes(debt_case_id) WHERE status = 'OPEN';
    DROP TYPE case_dispute_status;
  END IF;
END $$;

-- Migrate reason column if it uses old enum
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'case_disputes' AND column_name = 'reason'
      AND udt_name = 'case_dispute_reason'
  ) THEN
    ALTER TABLE case_disputes ALTER COLUMN reason TYPE enum_case_disputes_reason USING ((reason::text)::enum_case_disputes_reason);
    DROP TYPE case_dispute_reason;
  END IF;
END $$;
