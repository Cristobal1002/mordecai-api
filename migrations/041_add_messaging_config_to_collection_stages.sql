-- Migration: Add messaging_config to collection_stages
-- Description: Stage references templates and attachments by id (selectors only)

ALTER TABLE collection_stages
    ADD COLUMN IF NOT EXISTS messaging_config JSONB DEFAULT '{}';

COMMENT ON COLUMN collection_stages.messaging_config IS 'References: smsTemplateId, emailTemplateId, attachmentIds[]';
