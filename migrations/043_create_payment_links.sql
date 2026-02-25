-- Migration: Create payment_links table
-- Description: Token-based payment links with verification, tracking, expiration

CREATE TYPE payment_link_status AS ENUM ('PENDING', 'VERIFIED', 'PAID', 'EXPIRED', 'BLOCKED');
CREATE TYPE payment_link_verification_method AS ENUM ('LEASE_DATA', 'OTP');

CREATE TABLE payment_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    debt_case_id UUID NOT NULL REFERENCES debt_cases(id) ON DELETE CASCADE,
    payment_agreement_id UUID REFERENCES payment_agreements(id) ON DELETE SET NULL,
    token VARCHAR(128) NOT NULL UNIQUE,
    status payment_link_status DEFAULT 'PENDING',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    clicked_at TIMESTAMP WITH TIME ZONE,
    click_ip VARCHAR(64),
    click_user_agent TEXT,
    verification_attempts SMALLINT DEFAULT 0,
    verified_at TIMESTAMP WITH TIME ZONE,
    verification_method payment_link_verification_method,
    otp_code_hash VARCHAR(256),
    otp_expires_at TIMESTAMP WITH TIME ZONE,
    otp_attempts SMALLINT DEFAULT 0,
    otp_sent_to VARCHAR(160),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payment_links_tenant_debt_case ON payment_links(tenant_id, debt_case_id);
CREATE UNIQUE INDEX idx_payment_links_token ON payment_links(token);
CREATE INDEX idx_payment_links_status_expires ON payment_links(status, expires_at);

CREATE TRIGGER update_payment_links_updated_at BEFORE UPDATE ON payment_links
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE payment_links IS 'Token-based payment links. URL: /p/{token}. Replaces agreement ID in URLs.';
