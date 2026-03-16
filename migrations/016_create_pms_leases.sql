-- Migration: Create pms_leases table
-- Description: Leases/contracts; move-in/out, status, last note summary, in_collections

CREATE TABLE pms_leases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    pms_connection_id UUID NOT NULL REFERENCES pms_connections(id) ON DELETE CASCADE,
    pms_debtor_id UUID NOT NULL REFERENCES pms_debtors(id) ON DELETE CASCADE,
    pms_property_id UUID REFERENCES pms_properties(id) ON DELETE SET NULL,
    pms_unit_id UUID REFERENCES pms_units(id) ON DELETE SET NULL,
    external_id VARCHAR(256) NOT NULL,
    lease_number VARCHAR(64),
    status VARCHAR(32) DEFAULT 'active',
    move_in_date DATE,
    move_out_date DATE,
    last_note_summary TEXT,
    in_collections BOOLEAN DEFAULT false,
    last_external_updated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_pms_leases_connection_external UNIQUE (pms_connection_id, external_id)
);

CREATE INDEX idx_pms_leases_tenant ON pms_leases(tenant_id);
CREATE INDEX idx_pms_leases_connection ON pms_leases(pms_connection_id);
CREATE INDEX idx_pms_leases_debtor ON pms_leases(pms_debtor_id);
CREATE INDEX idx_pms_leases_status ON pms_leases(tenant_id, status);

CREATE TRIGGER update_pms_leases_updated_at BEFORE UPDATE ON pms_leases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
