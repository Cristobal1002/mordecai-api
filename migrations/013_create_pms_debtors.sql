-- Migration: Create pms_debtors table
-- Description: Debtors (person/company) synced from PMS; contact and preference flags

CREATE TABLE pms_debtors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    pms_connection_id UUID NOT NULL REFERENCES pms_connections(id) ON DELETE CASCADE,
    external_id VARCHAR(256) NOT NULL,
    display_name VARCHAR(256) NOT NULL,
    type VARCHAR(32) DEFAULT 'person',
    email VARCHAR(256),
    phone VARCHAR(64),
    address JSONB DEFAULT '{}',
    language VARCHAR(16),
    timezone VARCHAR(64),
    do_not_contact BOOLEAN DEFAULT false,
    do_not_call BOOLEAN DEFAULT false,
    meta JSONB DEFAULT '{}',
    last_external_updated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_pms_debtors_connection_external UNIQUE (pms_connection_id, external_id)
);

CREATE INDEX idx_pms_debtors_tenant ON pms_debtors(tenant_id);
CREATE INDEX idx_pms_debtors_connection ON pms_debtors(pms_connection_id);
CREATE INDEX idx_pms_debtors_email ON pms_debtors(tenant_id, email) WHERE email IS NOT NULL;
CREATE INDEX idx_pms_debtors_phone ON pms_debtors(tenant_id, phone) WHERE phone IS NOT NULL;

CREATE TRIGGER update_pms_debtors_updated_at BEFORE UPDATE ON pms_debtors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
