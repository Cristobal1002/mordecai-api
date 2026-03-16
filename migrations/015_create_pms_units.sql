-- Migration: Create pms_units table
-- Description: Units (apt/unit) from PMS (optional context)

CREATE TABLE pms_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    pms_connection_id UUID NOT NULL REFERENCES pms_connections(id) ON DELETE CASCADE,
    pms_property_id UUID REFERENCES pms_properties(id) ON DELETE SET NULL,
    external_id VARCHAR(256) NOT NULL,
    unit_number VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_pms_units_connection_external UNIQUE (pms_connection_id, external_id)
);

CREATE INDEX idx_pms_units_tenant ON pms_units(tenant_id);
CREATE INDEX idx_pms_units_connection ON pms_units(pms_connection_id);
CREATE INDEX idx_pms_units_property ON pms_units(pms_property_id);

CREATE TRIGGER update_pms_units_updated_at BEFORE UPDATE ON pms_units
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
