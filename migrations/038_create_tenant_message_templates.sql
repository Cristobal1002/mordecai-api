-- Migration: Create tenant_message_templates table
-- Description: Reusable SMS and Email templates per tenant for collection messaging

CREATE TABLE tenant_message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL,
    name VARCHAR(120) NOT NULL,
    subject VARCHAR(500),
    body_text TEXT NOT NULL,
    body_html TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_template_channel CHECK (channel IN ('sms', 'email'))
);

CREATE INDEX idx_tenant_message_templates_tenant ON tenant_message_templates(tenant_id);
CREATE INDEX idx_tenant_message_templates_tenant_channel ON tenant_message_templates(tenant_id, channel);

CREATE TRIGGER update_tenant_message_templates_updated_at BEFORE UPDATE ON tenant_message_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
