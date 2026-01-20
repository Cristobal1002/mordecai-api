-- Migration: Create payment_agreements table
-- Description: Acuerdos de pago

-- Create enum types
CREATE TYPE payment_agreement_type AS ENUM ('PROMISE_TO_PAY', 'INSTALLMENTS');
CREATE TYPE payment_agreement_status AS ENUM ('PROPOSED', 'ACCEPTED', 'CANCELLED', 'COMPLETED', 'BROKEN');
CREATE TYPE payment_agreement_provider AS ENUM ('STRIPE', 'NONE');
CREATE TYPE payment_agreement_created_by AS ENUM ('AI', 'USER', 'SYSTEM');

CREATE TABLE payment_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    debt_case_id UUID NOT NULL REFERENCES debt_cases(id) ON DELETE CASCADE,
    type payment_agreement_type NOT NULL,
    status payment_agreement_status DEFAULT 'PROPOSED',
    total_amount_cents BIGINT NOT NULL,
    down_payment_cents BIGINT,
    installments INTEGER,
    start_date DATE,
    promise_date DATE,
    payment_link_url TEXT,
    provider payment_agreement_provider DEFAULT 'NONE',
    provider_ref VARCHAR(160),
    terms JSONB DEFAULT '{}',
    created_by payment_agreement_created_by DEFAULT 'AI',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for lookups
CREATE INDEX idx_payment_agreements_tenant_debt_case ON payment_agreements(tenant_id, debt_case_id);
CREATE INDEX idx_payment_agreements_tenant_status ON payment_agreements(tenant_id, status);

-- Create trigger for updated_at
CREATE TRIGGER update_payment_agreements_updated_at BEFORE UPDATE ON payment_agreements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

