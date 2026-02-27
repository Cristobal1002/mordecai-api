-- Migration: Create payment_channel_types (catalog) and link tenant_payment_channels
-- Description: Dynamic schema per channel type. Backoffice can create new types (e.g. Stripe).

CREATE TABLE payment_channel_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(40) NOT NULL UNIQUE,
    label VARCHAR(120) NOT NULL,
    requires_reconciliation BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    config_schema JSONB DEFAULT '{"fields":[]}',
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payment_channel_types_code ON payment_channel_types(code);
CREATE INDEX idx_payment_channel_types_enabled ON payment_channel_types(is_enabled);

CREATE TRIGGER update_payment_channel_types_updated_at BEFORE UPDATE ON payment_channel_types
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add FK from tenant_payment_channels to payment_channel_types
ALTER TABLE tenant_payment_channels
ADD COLUMN IF NOT EXISTS channel_type_id UUID REFERENCES payment_channel_types(id) ON DELETE SET NULL;

CREATE INDEX idx_tenant_payment_channels_channel_type ON tenant_payment_channels(channel_type_id);

-- Seed default channel types with config_schema
INSERT INTO payment_channel_types (code, label, requires_reconciliation, sort_order, config_schema, is_enabled)
VALUES
  ('link', 'Payment link', false, 0, '{"fields":[{"key":"url","type":"string","label":"Payment link URL","required":false}]}', true),
  ('card', 'Debit/credit card', false, 1, '{"fields":[]}', true),
  ('transfer', 'Bank transfer', true, 2, '{"fields":[{"key":"banks","type":"array","label":"Bank accounts","required":false,"itemFields":[{"key":"bankName","type":"string","label":"Bank name","required":true},{"key":"accountType","type":"string","label":"Account type","required":true},{"key":"accountNumber","type":"string","label":"Account number","required":true},{"key":"routingNumber","type":"string","label":"Routing number","required":false},{"key":"accountHolder","type":"string","label":"Account holder","required":true},{"key":"observations","type":"text","label":"Observations","required":false}]}]}', true),
  ('zelle', 'Zelle', true, 3, '{"fields":[{"key":"email","type":"string","label":"Zelle email","required":false},{"key":"phone","type":"string","label":"Zelle phone","required":false}]}', true),
  ('cash', 'Cash (physical point)', true, 4, '{"fields":[{"key":"points","type":"array","label":"Physical payment points","required":false,"itemFields":[{"key":"name","type":"string","label":"Name","required":true},{"key":"address","type":"string","label":"Address","required":true},{"key":"hours","type":"string","label":"Hours","required":false},{"key":"instructions","type":"text","label":"Instructions","required":false}]}]}', true)
ON CONFLICT (code) DO NOTHING;

-- Link existing tenant_payment_channels to channel types by code
UPDATE tenant_payment_channels tpc
SET channel_type_id = pct.id
FROM payment_channel_types pct
WHERE tpc.code = pct.code AND tpc.channel_type_id IS NULL;

COMMENT ON TABLE payment_channel_types IS 'Catalog of payment channel types. config_schema defines dynamic form fields.';
COMMENT ON COLUMN payment_channel_types.config_schema IS 'JSON: { fields: [{ key, type, label, required?, itemFields? (for array type) }] }';
