-- Migration: Create pms_connections table
-- Description: Conexión por tenant a un software (estado, credenciales, last sync, errores)

CREATE TABLE pms_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    software_id UUID NOT NULL REFERENCES softwares(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    credentials JSONB,
    external_account_id VARCHAR(256),
    capabilities JSONB,
    last_synced_at TIMESTAMP WITH TIME ZONE,
    last_error JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_pms_connections_tenant_software UNIQUE (tenant_id, software_id)
);

CREATE INDEX idx_pms_connections_tenant_id ON pms_connections(tenant_id);
CREATE INDEX idx_pms_connections_software_id ON pms_connections(software_id);
CREATE INDEX idx_pms_connections_status ON pms_connections(status);

CREATE TRIGGER update_pms_connections_updated_at BEFORE UPDATE ON pms_connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
