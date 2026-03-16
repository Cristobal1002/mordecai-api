-- Migration: Create collection_automations table (Collections Engine v2)
-- Description: A strategy running continuously on a PMS connection

CREATE TABLE collection_automations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    pms_connection_id UUID NOT NULL REFERENCES pms_connections(id) ON DELETE CASCADE,
    strategy_id UUID NOT NULL REFERENCES collection_strategies(id) ON DELETE RESTRICT,
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'stopped')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    paused_at TIMESTAMP WITH TIME ZONE,
    last_evaluated_at TIMESTAMP WITH TIME ZONE,
    next_tick_at TIMESTAMP WITH TIME ZONE,
    stats JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_collection_automations_tenant ON collection_automations(tenant_id);
CREATE INDEX idx_collection_automations_connection ON collection_automations(pms_connection_id);
CREATE INDEX idx_collection_automations_status ON collection_automations(tenant_id, status);
CREATE INDEX idx_collection_automations_next_tick ON collection_automations(next_tick_at) WHERE status = 'active';

CREATE TRIGGER update_collection_automations_updated_at BEFORE UPDATE ON collection_automations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
