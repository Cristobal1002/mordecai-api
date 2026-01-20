-- Migration: Create interaction_logs table
-- Description: Registro de contacto omnicanal

-- Create enum types
CREATE TYPE interaction_log_type AS ENUM ('CALL', 'SMS', 'EMAIL');
CREATE TYPE interaction_log_direction AS ENUM ('OUTBOUND', 'INBOUND');
CREATE TYPE interaction_log_outcome AS ENUM (
    'CONNECTED',
    'NO_ANSWER',
    'VOICEMAIL',
    'FAILED',
    'PROMISE_TO_PAY',
    'PAYMENT_PLAN',
    'PAID',
    'REFUSED',
    'CALLBACK_REQUESTED'
);

CREATE TABLE interaction_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    debt_case_id UUID NOT NULL REFERENCES debt_cases(id) ON DELETE CASCADE,
    debtor_id UUID NOT NULL REFERENCES debtors(id) ON DELETE RESTRICT,
    type interaction_log_type NOT NULL,
    direction interaction_log_direction DEFAULT 'OUTBOUND',
    channel_provider VARCHAR(60),
    provider_ref VARCHAR(160),
    status VARCHAR(40) DEFAULT 'queued',
    outcome interaction_log_outcome,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    transcript TEXT,
    summary TEXT,
    ai_data JSONB DEFAULT '{}',
    error JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for lookups
CREATE INDEX idx_interaction_logs_tenant_debt_case_created ON interaction_logs(tenant_id, debt_case_id, created_at);
CREATE INDEX idx_interaction_logs_tenant_type_created ON interaction_logs(tenant_id, type, created_at);
CREATE INDEX idx_interaction_logs_tenant_provider_ref ON interaction_logs(tenant_id, provider_ref);

-- Create trigger for updated_at
CREATE TRIGGER update_interaction_logs_updated_at BEFORE UPDATE ON interaction_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

