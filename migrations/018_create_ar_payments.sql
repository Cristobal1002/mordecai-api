-- Migration: Create ar_payments table
-- Description: Payments applied; applied_to_charges for ledger

CREATE TABLE ar_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    pms_connection_id UUID NOT NULL REFERENCES pms_connections(id) ON DELETE CASCADE,
    pms_lease_id UUID REFERENCES pms_leases(id) ON DELETE CASCADE,
    external_id VARCHAR(256) NOT NULL,
    amount_cents BIGINT NOT NULL,
    currency VARCHAR(8) DEFAULT 'USD',
    paid_at TIMESTAMP WITH TIME ZONE NOT NULL,
    payment_method VARCHAR(64),
    applied_to_charges JSONB DEFAULT '[]',
    last_external_updated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_ar_payments_connection_external UNIQUE (pms_connection_id, external_id)
);

CREATE INDEX idx_ar_payments_tenant ON ar_payments(tenant_id);
CREATE INDEX idx_ar_payments_lease ON ar_payments(pms_lease_id);
CREATE INDEX idx_ar_payments_paid_at ON ar_payments(tenant_id, paid_at);

CREATE TRIGGER update_ar_payments_updated_at BEFORE UPDATE ON ar_payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
