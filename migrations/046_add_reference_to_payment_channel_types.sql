-- Migration: Add reference block to config_schema for reconciliation
-- Enables CASE-{caseId} style memos so tenants can match incoming payments to debt cases.

-- Update transfer (ACH) with reference block + enhanced fields
UPDATE payment_channel_types
SET config_schema = '{
  "fields": [
    {
      "key": "banks",
      "type": "array",
      "label": "Bank accounts",
      "required": false,
      "copyable": true,
      "itemFields": [
        {"key": "accountHolder", "type": "string", "label": "Beneficiary / Account holder", "required": true, "copyable": true},
        {"key": "bankName", "type": "string", "label": "Bank name", "required": true, "copyable": true},
        {"key": "routingNumber", "type": "string", "label": "Routing number (ABA 9 digits)", "required": true, "copyable": true, "validation": {"pattern": "^[0-9]{9}$"}},
        {"key": "accountNumber", "type": "string", "label": "Account number", "required": true, "copyable": true, "sensitive": true},
        {"key": "accountType", "type": "string", "label": "Account type", "required": true, "copyable": true},
        {"key": "instructions", "type": "text", "label": "Instructions", "required": false},
        {"key": "observations", "type": "text", "label": "Observations", "required": false},
        {"key": "estimatedPostingTime", "type": "string", "label": "Estimated posting time", "required": false, "hint": "e.g. 1-3 business days"}
      ]
    }
  ],
  "reference": {
    "required": true,
    "label": "Memo / Reference",
    "template": "CASE-{caseId}",
    "helpText": "Include this in the memo or reference field so we can apply your payment to the correct account.",
    "placeholders": ["caseId", "debtorId", "tenantId", "leaseExternalId"]
  }
}'::jsonb
WHERE code = 'transfer';

-- Update zelle with reference block
UPDATE payment_channel_types
SET config_schema = '{
  "fields": [
    {"key": "email", "type": "string", "label": "Zelle email", "required": false, "copyable": true},
    {"key": "phone", "type": "string", "label": "Zelle phone", "required": false, "copyable": true}
  ],
  "reference": {
    "required": true,
    "label": "Memo / Reference",
    "template": "CASE-{caseId}",
    "helpText": "Include this when sending the Zelle payment so we can apply it to your account.",
    "placeholders": ["caseId", "debtorId", "tenantId", "leaseExternalId"]
  }
}'::jsonb
WHERE code = 'zelle';

-- Update cash with reference block
UPDATE payment_channel_types
SET config_schema = '{
  "fields": [
    {
      "key": "points",
      "type": "array",
      "label": "Physical payment points",
      "required": false,
      "itemFields": [
        {"key": "name", "type": "string", "label": "Name", "required": true},
        {"key": "address", "type": "string", "label": "Address", "required": true, "copyable": true},
        {"key": "hours", "type": "string", "label": "Hours", "required": false},
        {"key": "instructions", "type": "text", "label": "Instructions", "required": false}
      ]
    }
  ],
  "reference": {
    "required": true,
    "label": "Reference number",
    "template": "CASE-{caseId}",
    "helpText": "Provide this reference when making your payment so we can apply it correctly.",
    "placeholders": ["caseId", "debtorId", "tenantId", "leaseExternalId"]
  }
}'::jsonb
WHERE code = 'cash';

-- Link: optional reference (often goes to external processor)
UPDATE payment_channel_types
SET config_schema = '{
  "fields": [
    {"key": "url", "type": "string", "label": "Payment link URL", "required": false}
  ],
  "reference": {
    "required": false,
    "label": "Memo / Reference",
    "template": "CASE-{caseId}",
    "helpText": "If the payment form has a memo field, include this reference.",
    "placeholders": ["caseId", "debtorId", "tenantId", "leaseExternalId"]
  }
}'::jsonb
WHERE code = 'link';

COMMENT ON COLUMN payment_channel_types.config_schema IS 'JSON: { fields: [...], reference?: { required, label, template, helpText, placeholders } }. Template uses {caseId}, {debtorId}, {tenantId}, {leaseExternalId}.';
