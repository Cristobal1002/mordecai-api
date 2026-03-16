-- Migration: Create ar_balances table
-- Description: Consolidated balance per lease (snapshot per as_of_date)

CREATE TABLE ar_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    pms_connection_id UUID NOT NULL REFERENCES pms_connections(id) ON DELETE CASCADE,
    pms_lease_id UUID NOT NULL REFERENCES pms_leases(id) ON DELETE CASCADE,
    balance_cents BIGINT NOT NULL,
    currency VARCHAR(8) DEFAULT 'USD',
    as_of_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_ar_balances_lease_as_of UNIQUE (pms_lease_id, as_of_date)
);

CREATE INDEX idx_ar_balances_tenant ON ar_balances(tenant_id);
CREATE INDEX idx_ar_balances_lease ON ar_balances(pms_lease_id);
CREATE INDEX idx_ar_balances_as_of ON ar_balances(pms_connection_id, as_of_date);

CREATE TRIGGER update_ar_balances_updated_at BEFORE UPDATE ON ar_balances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
