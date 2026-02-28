-- Tenant branding: new columns for pay landing page (white-label + OTP)
-- Run manually if your DB doesn't auto-sync.

ALTER TABLE tenant_brandings
  ADD COLUMN IF NOT EXISTS support_hours VARCHAR(80),
  ADD COLUMN IF NOT EXISTS show_powered_by BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS legal_disclaimer_override TEXT,
  ADD COLUMN IF NOT EXISTS otp_delivery_label_override VARCHAR(120);
