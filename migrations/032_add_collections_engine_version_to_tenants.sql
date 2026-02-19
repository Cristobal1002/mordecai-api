-- Migration: Add collections engine version (feature flag) to tenants
-- Description: v1 = legacy FlowPolicy; v2 = Strategies + Stages + Automations

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS collections_engine_version VARCHAR(8) NOT NULL DEFAULT 'v1'
  CHECK (collections_engine_version IN ('v1', 'v2'));

COMMENT ON COLUMN tenants.collections_engine_version IS 'Collections engine: v1 (FlowPolicy) or v2 (Strategy/Stage/Automation)';
