-- Migration: Create tenant_payment_channels table
-- Description: Payment channel catalog per tenant (link, transfer, zelle, cash, etc.)

CREATE TABLE tenant_payment_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(40) NOT NULL,
    label VARCHAR(120) NOT NULL,
    requires_reconciliation BOOLEAN DEFAULT false,
    instructions_template TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_tenant_payment_channels_tenant_code ON tenant_payment_channels(tenant_id, code);
CREATE INDEX idx_tenant_payment_channels_tenant ON tenant_payment_channels(tenant_id);

CREATE TRIGGER update_tenant_payment_channels_updated_at BEFORE UPDATE ON tenant_payment_channels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
