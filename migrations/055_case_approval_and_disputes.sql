-- Migration: Case approval and disputes
-- Description: approval_status on debt_cases, approval_mode/rules on automations, case_disputes table

-- 1) debt_cases.approval_status
ALTER TABLE debt_cases
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(32) DEFAULT 'APPROVED'
  CHECK (approval_status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'EXCLUDED'));

CREATE INDEX IF NOT EXISTS idx_debt_cases_approval_status ON debt_cases(tenant_id, approval_status);

-- 2) collection_automations.approval_mode, approval_rules
ALTER TABLE collection_automations
  ADD COLUMN IF NOT EXISTS approval_mode VARCHAR(32) DEFAULT 'AUTO'
  CHECK (approval_mode IN ('AUTO', 'REQUIRE_APPROVAL', 'HYBRID'));

ALTER TABLE collection_automations
  ADD COLUMN IF NOT EXISTS approval_rules JSONB DEFAULT '{}';

-- 3) case_disputes table (enum names must match Sequelize: enum_case_disputes_*)
DO $$ BEGIN
  CREATE TYPE enum_case_disputes_status AS ENUM ('OPEN', 'WAITING_TENANT', 'WAITING_DEBTOR', 'RESOLVED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE enum_case_disputes_reason AS ENUM (
    'PAID_ALREADY', 'WRONG_AMOUNT', 'WRONG_DEBTOR', 'LEASE_ENDED',
    'UNDER_LEGAL_REVIEW', 'PROMISE_OFFLINE', 'DO_NOT_CONTACT', 'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS case_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_case_id UUID NOT NULL REFERENCES debt_cases(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  status enum_case_disputes_status NOT NULL DEFAULT 'OPEN',
  reason enum_case_disputes_reason NOT NULL,
  notes TEXT,
  evidence_urls JSONB DEFAULT '[]',
  opened_by UUID,
  opened_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  resolved_by UUID,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_case_disputes_debt_case ON case_disputes(debt_case_id);
CREATE INDEX IF NOT EXISTS idx_case_disputes_tenant_status ON case_disputes(tenant_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_case_disputes_one_open_per_case
  ON case_disputes(debt_case_id) WHERE status = 'OPEN';

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_case_disputes_updated_at ON case_disputes;
CREATE TRIGGER update_case_disputes_updated_at BEFORE UPDATE ON case_disputes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE case_disputes IS 'Case holds: stops automation when OPEN. Reasons: paid, wrong amount, do not contact, etc.';
