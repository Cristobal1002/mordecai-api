-- Migration: Create sync_runs table
-- Description: History of sync jobs per connection; metrics, errors, step

CREATE TABLE sync_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pms_connection_id UUID NOT NULL REFERENCES pms_connections(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    triggered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,
    step VARCHAR(64),
    stats JSONB DEFAULT '{}',
    error_message TEXT,
    error_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sync_runs_connection ON sync_runs(pms_connection_id);
CREATE INDEX idx_sync_runs_status ON sync_runs(pms_connection_id, status);
CREATE INDEX idx_sync_runs_triggered ON sync_runs(pms_connection_id, triggered_at DESC);

CREATE TRIGGER update_sync_runs_updated_at BEFORE UPDATE ON sync_runs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
