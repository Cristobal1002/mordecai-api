-- Migration: Create external_mappings table
-- Description: Maps PMS external IDs to our internal IDs for deduplication and upsert

CREATE TABLE external_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pms_connection_id UUID NOT NULL REFERENCES pms_connections(id) ON DELETE CASCADE,
    entity_type VARCHAR(64) NOT NULL,
    external_id VARCHAR(256) NOT NULL,
    internal_entity_type VARCHAR(64) NOT NULL,
    internal_id UUID NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_external_mappings_connection_entity_external UNIQUE (pms_connection_id, entity_type, external_id)
);

CREATE INDEX idx_external_mappings_connection ON external_mappings(pms_connection_id);
CREATE INDEX idx_external_mappings_lookup ON external_mappings(pms_connection_id, entity_type, external_id);

CREATE TRIGGER update_external_mappings_updated_at BEFORE UPDATE ON external_mappings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
