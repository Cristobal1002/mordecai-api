-- Migration: Ensure unique (pms_connection_id, entity_type, external_id) on external_mappings
-- Description: Required for ExternalMapping.upsert ON CONFLICT. If the table was created by
--              Sequelize sync or the constraint was never applied, this adds it.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_external_mappings_connection_entity_external'
  ) THEN
    ALTER TABLE external_mappings
      ADD CONSTRAINT uq_external_mappings_connection_entity_external UNIQUE (pms_connection_id, entity_type, external_id);
  END IF;
END $$;
