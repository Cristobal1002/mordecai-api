-- Migration: Create case_automation_state table (Collections Engine v2)
-- Description: Per-case state when case is in an automation (next action, outcomes, promise)

CREATE TABLE case_automation_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    debt_case_id UUID NOT NULL REFERENCES debt_cases(id) ON DELETE CASCADE,
    automation_id UUID NOT NULL REFERENCES collection_automations(id) ON DELETE CASCADE,
    strategy_id UUID NOT NULL REFERENCES collection_strategies(id) ON DELETE RESTRICT,
    current_stage_id UUID REFERENCES collection_stages(id) ON DELETE SET NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed')),
    next_action_at TIMESTAMP WITH TIME ZONE,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    attempts_week_count INTEGER DEFAULT 0,
    promise_due_date DATE,
    last_outcome VARCHAR(64),
    last_outcome_at TIMESTAMP WITH TIME ZONE,
    meta JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_case_automation_state_case_automation UNIQUE (debt_case_id, automation_id)
);

CREATE INDEX idx_case_automation_state_debt_case ON case_automation_state(debt_case_id);
CREATE INDEX idx_case_automation_state_automation ON case_automation_state(automation_id);
CREATE INDEX idx_case_automation_state_next_action ON case_automation_state(automation_id, next_action_at) WHERE status = 'active';

CREATE TRIGGER update_case_automation_state_updated_at BEFORE UPDATE ON case_automation_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
