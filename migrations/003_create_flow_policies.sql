-- Migration: Create flow_policies table
-- Description: Reglas de cobranza por rango de days_past_due

CREATE TABLE flow_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    min_days_past_due INTEGER NOT NULL,
    max_days_past_due INTEGER,
    channels JSONB DEFAULT '{}',
    tone VARCHAR(40) DEFAULT 'professional',
    rules JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for policy lookups by days_past_due range
CREATE INDEX idx_flow_policies_tenant_days ON flow_policies(tenant_id, min_days_past_due, max_days_past_due);

-- Create trigger for updated_at
CREATE TRIGGER update_flow_policies_updated_at BEFORE UPDATE ON flow_policies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

