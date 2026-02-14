-- Migration: Create ar_adjustments table
-- Description: Credits, write-offs, adjustments

CREATE TABLE ar_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    pms_connection_id UUID NOT NULL REFERENCES pms_connections(id) ON DELETE CASCADE,
    pms_lease_id UUID REFERENCES pms_leases(id) ON DELETE CASCADE,
    external_id VARCHAR(256),
    adjustment_type VARCHAR(64),
    amount_cents BIGINT NOT NULL,
    currency VARCHAR(8) DEFAULT 'USD',
    applied_at TIMESTAMP WITH TIME ZONE,
    description TEXT,
    last_external_updated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ar_adjustments_tenant ON ar_adjustments(tenant_id);
CREATE INDEX idx_ar_adjustments_lease ON ar_adjustments(pms_lease_id);

CREATE TRIGGER update_ar_adjustments_updated_at BEFORE UPDATE ON ar_adjustments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
