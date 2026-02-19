-- Migration: Create collection_strategies table (Collections Engine v2)
-- Description: Strategy container - global rules, limits, time window

CREATE TABLE collection_strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    global_rules JSONB DEFAULT '{}',
    max_attempts_per_week INTEGER,
    cooldown_hours INTEGER,
    allowed_time_window VARCHAR(64),
    stop_on_promise BOOLEAN DEFAULT true,
    stop_on_payment BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_collection_strategies_tenant ON collection_strategies(tenant_id);
CREATE INDEX idx_collection_strategies_tenant_active ON collection_strategies(tenant_id, is_active);

CREATE TRIGGER update_collection_strategies_updated_at BEFORE UPDATE ON collection_strategies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
