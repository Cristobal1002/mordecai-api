-- Migration: Refine transfer config_schema for USA
-- - accountType as select (checking|savings)
-- - banks.required: true, minItems: 1, requireExactlyOnePrimary: true
-- - isPrimary required: true (default false in UI)
-- - estimatedPostingTime as select (same_day, 1-2_business_days, 1-3_business_days)
-- - observations -> internalNotes
-- - routingNumber hint, reference.copyable

-- Migrate observations -> internalNotes in existing tenant configs (banks array)
UPDATE tenant_payment_channels
SET config = jsonb_set(
  config,
  '{banks}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN elem ? 'observations' THEN (elem - 'observations') || jsonb_build_object('internalNotes', elem->'observations')
        ELSE elem
      END
    )
    FROM jsonb_array_elements(config->'banks') AS elem
  )
)
WHERE config ? 'banks'
  AND jsonb_typeof(config->'banks') = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(config->'banks') elem
    WHERE elem ? 'observations'
    LIMIT 1
  );

UPDATE payment_channel_types
SET config_schema = '{
  "fields": [
    {
      "key": "banks",
      "type": "array",
      "label": "Bank accounts",
      "required": true,
      "minItems": 1,
      "requireExactlyOnePrimary": true,
      "copyable": true,
      "itemFields": [
        {"key": "accountHolder", "type": "string", "label": "Beneficiary / Account holder", "required": true, "copyable": true, "scope": "debtor"},
        {"key": "bankName", "type": "string", "label": "Bank name", "required": true, "copyable": true, "scope": "debtor"},
        {"key": "routingNumber", "type": "string", "label": "Routing number", "required": true, "copyable": true, "validation": {"pattern": "^[0-9]{9}$"}, "hint": "9-digit ABA routing number", "scope": "debtor"},
        {"key": "accountNumber", "type": "string", "label": "Account number", "required": true, "copyable": true, "sensitive": true, "scope": "debtor"},
        {"key": "accountType", "type": "select", "label": "Account type", "required": true, "copyable": true, "options": ["checking", "savings"], "scope": "debtor"},
        {"key": "instructions", "type": "text", "label": "Instructions", "required": false, "scope": "debtor"},
        {"key": "internalNotes", "type": "text", "label": "Internal notes", "required": false, "scope": "tenant_admin"},
        {"key": "estimatedPostingTime", "type": "select", "label": "Estimated posting time", "required": false, "scope": "debtor", "options": ["same_day", "1-2_business_days", "1-3_business_days"], "optionLabels": {"same_day": "Same day", "1-2_business_days": "1-2 business days", "1-3_business_days": "1-3 business days"}},
        {"key": "isPrimary", "type": "boolean", "label": "Primary (show to debtor)", "required": true, "scope": "tenant_admin"}
      ]
    }
  ],
  "reference": {
    "required": true,
    "copyable": true,
    "label": "Memo / Reference",
    "template": "MC-{casePublicId}",
    "helpText": "Include this in the memo or reference field so we can apply your payment. Recommended: use the short code above.",
    "placeholders": ["caseId", "casePublicId", "debtorId", "tenantId", "leaseExternalId"]
  }
}'::jsonb
WHERE code = 'transfer';
