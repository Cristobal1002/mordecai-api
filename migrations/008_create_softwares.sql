-- Migration: Create softwares table
-- Description: Lista de softwares disponibles (Buildium, Rentvine, etc.): auth, capabilities, logo, docs

CREATE TABLE softwares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(64) NOT NULL,
    name VARCHAR(120) NOT NULL,
    category VARCHAR(64) NOT NULL,
    auth_type VARCHAR(32) NOT NULL,
    auth_config JSONB DEFAULT '{}',
    capabilities JSONB DEFAULT '{}',
    logo_url VARCHAR(512),
    docs_url VARCHAR(512),
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_softwares_key ON softwares(key);
CREATE INDEX idx_softwares_category ON softwares(category);
CREATE INDEX idx_softwares_is_enabled ON softwares(is_enabled);

CREATE TRIGGER update_softwares_updated_at BEFORE UPDATE ON softwares
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
