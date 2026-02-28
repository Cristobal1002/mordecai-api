-- Migration: Case approval status and disputes
-- Description: Adds approval flow (PENDING_APPROVAL, APPROVED, REJECTED, EXCLUDED) and case_disputes table

-- 1) debt_cases.approval_status
ALTER TABLE debt_cases
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(32) DEFAULT 'APPROVED'
    CHECK (approval_status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'EXCLUDED'));

CREATE INDEX IF NOT EXISTS idx_debt_cases_approval_status
  ON debt_cases(tenant_id, approval_status);

-- 2) collection_automations.approval_mode and approval_rules
ALTER TABLE collection_automations
  ADD COLUMN IF NOT EXISTS approval_mode VARCHAR(32) DEFAULT 'AUTO'
    CHECK (approval_mode IN ('AUTO', 'REQUIRE_APPROVAL', 'HYBRID'));

ALTER TABLE collection_automations
  ADD COLUMN IF NOT EXISTS approval_rules JSONB DEFAULT '{}';

-- approval_rules schema: { "autoApproveMaxDpd": 30, "autoApproveMaxAmountCents": 50000, ... }

-- 3) case_disputes table
-- Note: opened_by/resolved_by reference users(id); users table may exist via auth
CREATE TABLE IF NOT EXISTS case_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_case_id UUID NOT NULL REFERENCES debt_cases(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'WAITING_TENANT', 'WAITING_DEBTOR', 'RESOLVED', 'CLOSED')),
  reason VARCHAR(64) NOT NULL
    CHECK (reason IN (
      'PAID_ALREADY', 'WRONG_AMOUNT', 'WRONG_DEBTOR', 'LEASE_ENDED',
      'UNDER_LEGAL_REVIEW', 'PROMISE_OFFLINE', 'DO_NOT_CONTACT', 'OTHER'
    )),
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

CREATE INDEX idx_case_disputes_debt_case ON case_disputes(debt_case_id);
CREATE INDEX idx_case_disputes_tenant_status ON case_disputes(tenant_id, status);

-- At most one OPEN dispute per debt_case
CREATE UNIQUE INDEX idx_case_disputes_one_open_per_case
  ON case_disputes(debt_case_id) WHERE status = 'OPEN';

CREATE TRIGGER update_case_disputes_updated_at BEFORE UPDATE ON case_disputes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE case_disputes IS 'Case holds: pause automation, track reason and resolution. One OPEN dispute per case.';
