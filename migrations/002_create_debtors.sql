-- Migration: Create debtors table
-- Description: Deudores/Cartera

CREATE TABLE debtors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    external_ref VARCHAR(128),
    full_name VARCHAR(160) NOT NULL,
    email VARCHAR(160),
    phone VARCHAR(40),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for lookups
CREATE INDEX idx_debtors_tenant_email ON debtors(tenant_id, email);
CREATE INDEX idx_debtors_tenant_phone ON debtors(tenant_id, phone);
CREATE INDEX idx_debtors_tenant_external_ref ON debtors(tenant_id, external_ref);

-- Create trigger for updated_at
CREATE TRIGGER update_debtors_updated_at BEFORE UPDATE ON debtors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

