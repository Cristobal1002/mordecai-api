-- Migration: Create collection_events table (Collections Engine v2)
-- Description: Activity log for automations (scheduled, sent, failed, answered, promise, payment_detected, etc.)

CREATE TABLE collection_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id UUID NOT NULL REFERENCES collection_automations(id) ON DELETE CASCADE,
    debt_case_id UUID REFERENCES debt_cases(id) ON DELETE SET NULL,
    channel VARCHAR(32),
    event_type VARCHAR(64) NOT NULL,
    payload JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_collection_events_automation ON collection_events(automation_id);
CREATE INDEX idx_collection_events_debt_case ON collection_events(debt_case_id);
CREATE INDEX idx_collection_events_created ON collection_events(automation_id, created_at DESC);
