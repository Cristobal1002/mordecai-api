-- Migration: Create tenant_brandings table
-- Description: White-label branding per tenant for payment pages (1:1 with Tenant)

CREATE TABLE tenant_brandings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    company_name VARCHAR(160),
    logo_url TEXT,
    primary_color VARCHAR(7),
    secondary_color VARCHAR(7),
    support_email VARCHAR(160),
    support_phone VARCHAR(40),
    footer_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_tenant_brandings_tenant ON tenant_brandings(tenant_id);

CREATE TRIGGER update_tenant_brandings_updated_at BEFORE UPDATE ON tenant_brandings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE tenant_brandings IS 'White-label branding for payment pages. When null, use Mordecai defaults.';
