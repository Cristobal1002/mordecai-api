-- Migration: Create collection_stages table (Collections Engine v2)
-- Description: Stage = range of days_past_due within a strategy (replaces FlowPolicy per-strategy)

CREATE TABLE collection_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy_id UUID NOT NULL REFERENCES collection_strategies(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    min_days_past_due INTEGER NOT NULL,
    max_days_past_due INTEGER,
    channels JSONB DEFAULT '{}',
    tone VARCHAR(40) DEFAULT 'professional',
    rules JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_stage_range CHECK (max_days_past_due IS NULL OR min_days_past_due <= max_days_past_due)
);

CREATE INDEX idx_collection_stages_strategy ON collection_stages(strategy_id);
CREATE INDEX idx_collection_stages_strategy_days ON collection_stages(strategy_id, min_days_past_due, max_days_past_due);

CREATE TRIGGER update_collection_stages_updated_at BEFORE UPDATE ON collection_stages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
