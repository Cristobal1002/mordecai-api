-- Migration: Zelle recipients schema (USA)
-- - recipients array (recipientName, handleType, handleValue, instructions, estimatedPostingTime, internalNotes, isPrimary)
-- - Conditional validation: handleType=email → validate email; handleType=phone → validate E.164
-- - reference: MC-{casePublicId}, copyable, short memo hint for Zelle

-- Migrate old zelle config (email/phone) to recipients array
DO $$
DECLARE
  r RECORD;
  new_records jsonb;
  rec jsonb;
BEGIN
  FOR r IN
    SELECT tpc.id, tpc.config
    FROM tenant_payment_channels tpc
    JOIN payment_channel_types pct ON tpc.channel_type_id = pct.id
    WHERE pct.code = 'zelle'
      AND (tpc.config ? 'email' OR tpc.config ? 'phone')
      AND NOT (tpc.config ? 'recipients')
      AND (
        (tpc.config->>'email' IS NOT NULL AND trim(coalesce(tpc.config->>'email', '')) != '')
        OR (tpc.config->>'phone' IS NOT NULL AND trim(coalesce(tpc.config->>'phone', '')) != '')
      )
  LOOP
    new_records := '[]'::jsonb;
    IF r.config->>'email' IS NOT NULL AND trim(r.config->>'email') != '' THEN
      rec := jsonb_build_object('recipientName', 'Zelle', 'handleType', 'email', 'handleValue', r.config->>'email', 'isPrimary', true);
      new_records := new_records || jsonb_build_array(rec);
    END IF;
    IF r.config->>'phone' IS NOT NULL AND trim(r.config->>'phone') != '' THEN
      rec := jsonb_build_object('recipientName', 'Zelle', 'handleType', 'phone', 'handleValue', r.config->>'phone', 'isPrimary', (jsonb_array_length(new_records) = 0));
      new_records := new_records || jsonb_build_array(rec);
    END IF;
    IF jsonb_array_length(new_records) > 0 THEN
      UPDATE tenant_payment_channels SET config = jsonb_build_object('recipients', new_records) WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

-- Update zelle config_schema
UPDATE payment_channel_types
SET config_schema = '{
  "fields": [
    {
      "key": "recipients",
      "type": "array",
      "label": "Zelle recipients",
      "required": true,
      "minItems": 1,
      "requireExactlyOnePrimary": true,
      "copyable": true,
      "itemFields": [
        {"key": "recipientName", "type": "string", "label": "Recipient name", "required": true, "copyable": true, "scope": "debtor"},
        {"key": "handleType", "type": "select", "label": "Send to", "required": true, "options": ["email", "phone"], "scope": "debtor"},
        {"key": "handleValue", "type": "string", "label": "Email or phone", "required": true, "copyable": true, "hint": "Email or US phone in E.164 format (+1XXXXXXXXXX)", "scope": "debtor", "validation": {"dependsOn": "handleType", "patternByField": {"email": "^[^@]+@[^@]+\\.[^@]+$", "phone": "^\\+1[0-9]{10}$"}}, "dynamicLabelByField": {"handleType": {"email": "Zelle email", "phone": "Zelle phone"}}, "dynamicHintByField": {"handleType": {"email": "e.g. email@zelle.com", "phone": "US phone in E.164 format: +1XXXXXXXXXX"}}},
        {"key": "instructions", "type": "text", "label": "Instructions", "required": false, "scope": "debtor"},
        {"key": "estimatedPostingTime", "type": "select", "label": "Estimated posting time", "required": false, "scope": "debtor", "options": ["minutes", "same_day"], "optionLabels": {"minutes": "Minutes", "same_day": "Same day"}},
        {"key": "internalNotes", "type": "text", "label": "Internal notes", "required": false, "scope": "tenant_admin"},
        {"key": "isPrimary", "type": "boolean", "label": "Primary (show to debtor)", "required": true, "scope": "tenant_admin"}
      ]
    }
  ],
  "reference": {
    "required": true,
    "copyable": true,
    "label": "Memo / Reference",
    "template": "MC-{casePublicId}",
    "helpText": "Include this in the memo so we can apply your payment. If Zelle limits memo length, use the short code above.",
    "placeholders": ["caseId", "casePublicId", "debtorId", "tenantId", "leaseExternalId"]
  }
}'::jsonb
WHERE code = 'zelle';
