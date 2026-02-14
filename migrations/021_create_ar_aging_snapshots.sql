-- Migration: Create ar_aging_snapshots table
-- Description: Aging snapshot per connection per date (total + buckets 0-30, 31-60, 61-90, 90+)

CREATE TABLE ar_aging_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    pms_connection_id UUID NOT NULL REFERENCES pms_connections(id) ON DELETE CASCADE,
    as_of_date DATE NOT NULL,
    total_cents BIGINT NOT NULL DEFAULT 0,
    bucket_0_30_cents BIGINT NOT NULL DEFAULT 0,
    bucket_31_60_cents BIGINT NOT NULL DEFAULT 0,
    bucket_61_90_cents BIGINT NOT NULL DEFAULT 0,
    bucket_90_plus_cents BIGINT NOT NULL DEFAULT 0,
    currency VARCHAR(8) DEFAULT 'USD',
    meta JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_ar_aging_snapshots_connection_as_of UNIQUE (pms_connection_id, as_of_date)
);

CREATE INDEX idx_ar_aging_snapshots_tenant ON ar_aging_snapshots(tenant_id);
CREATE INDEX idx_ar_aging_snapshots_connection ON ar_aging_snapshots(pms_connection_id);
CREATE INDEX idx_ar_aging_snapshots_as_of ON ar_aging_snapshots(pms_connection_id, as_of_date);
