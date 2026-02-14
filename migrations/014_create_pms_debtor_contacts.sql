-- Migration: Create pms_debtor_contacts table
-- Description: Emails, phones, postal addresses per pms_debtor

CREATE TABLE pms_debtor_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pms_debtor_id UUID NOT NULL REFERENCES pms_debtors(id) ON DELETE CASCADE,
    contact_type VARCHAR(32) NOT NULL,
    value VARCHAR(512) NOT NULL,
    label VARCHAR(64),
    is_primary BOOLEAN DEFAULT false,
    external_id VARCHAR(256),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pms_debtor_contacts_debtor ON pms_debtor_contacts(pms_debtor_id);
CREATE INDEX idx_pms_debtor_contacts_type ON pms_debtor_contacts(pms_debtor_id, contact_type);

CREATE TRIGGER update_pms_debtor_contacts_updated_at BEFORE UPDATE ON pms_debtor_contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
