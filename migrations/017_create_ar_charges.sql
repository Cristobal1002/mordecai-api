-- Migration: Create ar_charges table
-- Description: Charges/invoices from PMS with due date for aging

CREATE TABLE ar_charges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    pms_connection_id UUID NOT NULL REFERENCES pms_connections(id) ON DELETE CASCADE,
    pms_lease_id UUID NOT NULL REFERENCES pms_leases(id) ON DELETE CASCADE,
    external_id VARCHAR(256) NOT NULL,
    charge_type VARCHAR(64),
    amount_cents BIGINT NOT NULL,
    currency VARCHAR(8) DEFAULT 'USD',
    due_date DATE NOT NULL,
    post_date DATE,
    description TEXT,
    last_external_updated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_ar_charges_connection_external UNIQUE (pms_connection_id, external_id)
);

CREATE INDEX idx_ar_charges_tenant ON ar_charges(tenant_id);
CREATE INDEX idx_ar_charges_lease ON ar_charges(pms_lease_id);
CREATE INDEX idx_ar_charges_due_date ON ar_charges(tenant_id, due_date);

CREATE TRIGGER update_ar_charges_updated_at BEFORE UPDATE ON ar_charges
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
