-- Migration: Create debt_cases table
-- Description: Caso de cobranza (core)

-- Create enum type for debt case status
CREATE TYPE debt_case_status AS ENUM (
    'NEW',
    'IN_PROGRESS',
    'CONTACTED',
    'PROMISE_TO_PAY',
    'PAYMENT_PLAN',
    'PAID',
    'NO_ANSWER',
    'REFUSED',
    'INVALID_CONTACT'
);

CREATE TABLE debt_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    debtor_id UUID NOT NULL REFERENCES debtors(id) ON DELETE RESTRICT,
    flow_policy_id UUID REFERENCES flow_policies(id) ON DELETE SET NULL,
    import_batch_id UUID REFERENCES import_batches(id) ON DELETE SET NULL,
    amount_due_cents BIGINT NOT NULL,
    currency VARCHAR(8) DEFAULT 'USD',
    days_past_due INTEGER NOT NULL,
    due_date DATE,
    status debt_case_status DEFAULT 'NEW',
    last_contacted_at TIMESTAMP WITH TIME ZONE,
    next_action_at TIMESTAMP WITH TIME ZONE,
    payment_link_url TEXT,
    meta JSONB DEFAULT '{}',
    closed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for lookups
CREATE INDEX idx_debt_cases_tenant_status ON debt_cases(tenant_id, status);
CREATE INDEX idx_debt_cases_tenant_days_past_due ON debt_cases(tenant_id, days_past_due);
CREATE INDEX idx_debt_cases_tenant_next_action ON debt_cases(tenant_id, next_action_at);
CREATE INDEX idx_debt_cases_tenant_debtor ON debt_cases(tenant_id, debtor_id);

-- Create trigger for updated_at
CREATE TRIGGER update_debt_cases_updated_at BEFORE UPDATE ON debt_cases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

