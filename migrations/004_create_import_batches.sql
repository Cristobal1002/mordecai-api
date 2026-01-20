-- Migration: Create import_batches table
-- Description: Auditoría de importación XLSX

-- Create enum types
CREATE TYPE import_batch_source AS ENUM ('XLSX', 'ERP');
CREATE TYPE import_batch_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    source import_batch_source DEFAULT 'XLSX',
    file_key VARCHAR(512),
    status import_batch_status DEFAULT 'PENDING',
    total_rows INTEGER DEFAULT 0,
    success_rows INTEGER DEFAULT 0,
    error_rows INTEGER DEFAULT 0,
    errors JSONB DEFAULT '[]',
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for lookups
CREATE INDEX idx_import_batches_tenant_created ON import_batches(tenant_id, created_at);

-- Create trigger for updated_at
CREATE TRIGGER update_import_batches_updated_at BEFORE UPDATE ON import_batches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

