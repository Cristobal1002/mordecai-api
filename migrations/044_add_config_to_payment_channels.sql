-- Migration: Add config JSONB to tenant_payment_channels
-- Description: Store structured config per channel (banks for transfer, zelle email/phone, cash points, link url)
-- Config shapes:
--   transfer: { banks: [{ bankName, accountNumber, routingNumber?, accountHolder, currency? }] }
--   zelle: { email?: string, phone?: string }
--   cash: { points: [{ name, address, hours?, instructions? }] }
--   link: { url?: string }
--   card: {} (no config)

ALTER TABLE tenant_payment_channels
ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}';

COMMENT ON COLUMN tenant_payment_channels.config IS 'Structured config for AI to provide payment details: transfer banks, zelle contact, cash points, link url';
