-- Migration: Create software_setup_steps table
-- Description: Pasos del wizard de configuración por software (orden, título, body, type, copy/link/media)

CREATE TABLE software_setup_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    software_id UUID NOT NULL REFERENCES softwares(id) ON DELETE CASCADE,
    "order" INTEGER NOT NULL,
    title VARCHAR(256) NOT NULL,
    body TEXT,
    type VARCHAR(32) NOT NULL,
    copy_value TEXT,
    link_url VARCHAR(512),
    media_url VARCHAR(512),
    meta JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_software_setup_steps_software_order UNIQUE (software_id, "order")
);

CREATE INDEX idx_software_setup_steps_software_id ON software_setup_steps(software_id);

CREATE TRIGGER update_software_setup_steps_updated_at BEFORE UPDATE ON software_setup_steps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
