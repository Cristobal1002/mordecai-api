-- Migration: Create pms_properties table
-- Description: Properties/communities from PMS (optional context)

CREATE TABLE pms_properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    pms_connection_id UUID NOT NULL REFERENCES pms_connections(id) ON DELETE CASCADE,
    external_id VARCHAR(256) NOT NULL,
    name VARCHAR(256),
    address JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_pms_properties_connection_external UNIQUE (pms_connection_id, external_id)
);

CREATE INDEX idx_pms_properties_tenant ON pms_properties(tenant_id);
CREATE INDEX idx_pms_properties_connection ON pms_properties(pms_connection_id);

CREATE TRIGGER update_pms_properties_updated_at BEFORE UPDATE ON pms_properties
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
