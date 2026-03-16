-- Migration: Add check payment channel type (USA)
-- Payee (flat fields) + deliveryMethods (mail/drop-off) + reference MC-{casePublicId}

INSERT INTO payment_channel_types (code, label, requires_reconciliation, sort_order, config_schema, is_enabled)
VALUES (
  'check',
  'Check (mail or drop-off)',
  true,
  4,
  '{
    "fields": [
      {"key": "payeeName", "type": "string", "label": "Payee (who to write the check to)", "required": true, "copyable": true, "scope": "debtor"},
      {"key": "companyName", "type": "string", "label": "Company name (optional)", "required": false, "copyable": true, "scope": "debtor"},
      {"key": "memoHint", "type": "text", "label": "What to write in memo (optional)", "required": false, "scope": "debtor"},
      {"key": "internalNotes", "type": "text", "label": "Internal notes", "required": false, "scope": "tenant_admin"},
      {
        "key": "deliveryMethods",
        "type": "array",
        "label": "Where to send / drop off the check",
        "required": true,
        "minItems": 1,
        "requireExactlyOnePrimary": true,
        "copyable": true,
        "itemFields": [
          {"key": "methodType", "type": "select", "label": "Method", "required": true, "options": ["mail", "drop_off"], "optionLabels": {"mail": "Mail", "drop_off": "Drop-off"}, "scope": "debtor"},
          {"key": "methodName", "type": "string", "label": "Location name", "required": true, "copyable": true, "scope": "debtor"},
          {"key": "addressLine1", "type": "string", "label": "Address line 1", "required": true, "copyable": true, "hint": "Street address or PO Box", "scope": "debtor"},
          {"key": "addressLine2", "type": "string", "label": "Address line 2", "required": false, "copyable": true, "scope": "debtor"},
          {"key": "city", "type": "string", "label": "City", "required": true, "copyable": true, "scope": "debtor"},
          {"key": "state", "type": "string", "label": "State", "required": true, "copyable": true, "validation": {"pattern": "^[A-Z]{2}$"}, "hint": "2-letter state code (e.g. CA, FL)", "scope": "debtor"},
          {"key": "zip", "type": "string", "label": "ZIP code", "required": true, "copyable": true, "validation": {"pattern": "^[0-9]{5}(-[0-9]{4})?$"}, "hint": "e.g. 94105 or 94105-1234", "scope": "debtor"},
          {"key": "attn", "type": "string", "label": "ATTN (optional)", "required": false, "copyable": true, "hint": "e.g. Attn: Accounts Receivable", "scope": "debtor"},
          {"key": "instructions", "type": "text", "label": "Instructions", "required": false, "scope": "debtor"},
          {"key": "hours", "type": "text", "label": "Hours (drop-off only)", "required": false, "hint": "e.g. Mon–Fri 9am–5pm", "scope": "debtor"},
          {"key": "phone", "type": "string", "label": "Phone (optional)", "required": false, "copyable": true, "hint": "e.g. +1...", "scope": "debtor"},
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
      "helpText": "Write this code in the memo line of your check so we can apply your payment correctly.",
      "placeholders": ["caseId", "casePublicId", "debtorId", "tenantId", "leaseExternalId"]
    }
  }'::jsonb,
  true
)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  requires_reconciliation = EXCLUDED.requires_reconciliation,
  sort_order = EXCLUDED.sort_order,
  config_schema = EXCLUDED.config_schema,
  is_enabled = EXCLUDED.is_enabled,
  updated_at = CURRENT_TIMESTAMP;
