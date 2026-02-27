-- Migration: Add isPrimary to banks, scope to fields, default template uses casePublicId

-- Update transfer: isPrimary, scope, template MC-{casePublicId} (recommended for memo)
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
        {"key": "accountHolder", "type": "string", "label": "Beneficiary / Account holder", "required": true, "copyable": true, "scope": "debtor"},
        {"key": "bankName", "type": "string", "label": "Bank name", "required": true, "copyable": true, "scope": "debtor"},
        {"key": "routingNumber", "type": "string", "label": "Routing number (ABA 9 digits)", "required": true, "copyable": true, "validation": {"pattern": "^[0-9]{9}$"}, "scope": "debtor"},
        {"key": "accountNumber", "type": "string", "label": "Account number", "required": true, "copyable": true, "sensitive": true, "scope": "debtor"},
        {"key": "accountType", "type": "string", "label": "Account type", "required": true, "copyable": true, "scope": "debtor"},
        {"key": "instructions", "type": "text", "label": "Instructions", "required": false, "scope": "debtor"},
        {"key": "observations", "type": "text", "label": "Internal notes", "required": false, "scope": "tenant_admin"},
        {"key": "estimatedPostingTime", "type": "string", "label": "Estimated posting time", "required": false, "hint": "e.g. 1-3 business days", "scope": "debtor"},
        {"key": "isPrimary", "type": "boolean", "label": "Primary (show to debtor)", "required": false, "scope": "tenant_admin"}
      ]
    }
  ],
  "reference": {
    "required": true,
    "label": "Memo / Reference",
    "template": "MC-{casePublicId}",
    "helpText": "Include this in the memo or reference field so we can apply your payment. Recommended: use the short code above.",
    "placeholders": ["caseId", "casePublicId", "debtorId", "tenantId", "leaseExternalId"]
  }
}'::jsonb
WHERE code = 'transfer';

-- Update zelle: scope, casePublicId template
UPDATE payment_channel_types
SET config_schema = '{
  "fields": [
    {"key": "email", "type": "string", "label": "Zelle email", "required": false, "copyable": true, "scope": "debtor"},
    {"key": "phone", "type": "string", "label": "Zelle phone", "required": false, "copyable": true, "scope": "debtor"}
  ],
  "reference": {
    "required": true,
    "label": "Memo / Reference",
    "template": "MC-{casePublicId}",
    "helpText": "Include this when sending the Zelle payment so we can apply it to your account.",
    "placeholders": ["caseId", "casePublicId", "debtorId", "tenantId", "leaseExternalId"]
  }
}'::jsonb
WHERE code = 'zelle';

-- Update cash: scope, casePublicId template
UPDATE payment_channel_types
SET config_schema = '{
  "fields": [
    {
      "key": "points",
      "type": "array",
      "label": "Physical payment points",
      "required": false,
      "itemFields": [
        {"key": "name", "type": "string", "label": "Name", "required": true, "scope": "debtor"},
        {"key": "address", "type": "string", "label": "Address", "required": true, "copyable": true, "scope": "debtor"},
        {"key": "hours", "type": "string", "label": "Hours", "required": false, "scope": "debtor"},
        {"key": "instructions", "type": "text", "label": "Instructions", "required": false, "scope": "debtor"}
      ]
    }
  ],
  "reference": {
    "required": true,
    "label": "Reference number",
    "template": "MC-{casePublicId}",
    "helpText": "Provide this reference when making your payment so we can apply it correctly.",
    "placeholders": ["caseId", "casePublicId", "debtorId", "tenantId", "leaseExternalId"]
  }
}'::jsonb
WHERE code = 'cash';

-- Update link: casePublicId template
UPDATE payment_channel_types
SET config_schema = '{
  "fields": [
    {"key": "url", "type": "string", "label": "Payment link URL", "required": false}
  ],
  "reference": {
    "required": false,
    "label": "Memo / Reference",
    "template": "MC-{casePublicId}",
    "helpText": "If the payment form has a memo field, include this reference.",
    "placeholders": ["caseId", "casePublicId", "debtorId", "tenantId", "leaseExternalId"]
  }
}'::jsonb
WHERE code = 'link';
