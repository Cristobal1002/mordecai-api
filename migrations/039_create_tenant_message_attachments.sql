-- Migration: Create tenant_message_attachments table
-- Description: Reusable attachments (eviction letters, notices) per tenant for email

CREATE TABLE tenant_message_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    type VARCHAR(40) DEFAULT 'custom',
    file_key VARCHAR(512) NOT NULL,
    min_days_past_due INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tenant_message_attachments_tenant ON tenant_message_attachments(tenant_id);

CREATE TRIGGER update_tenant_message_attachments_updated_at BEFORE UPDATE ON tenant_message_attachments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
