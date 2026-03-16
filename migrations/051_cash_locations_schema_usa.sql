-- Migration: Cash locations schema (USA)
-- - locations array (locationName, recipientName, addressLine1, addressLine2, city, state, zip, hours, phone, instructions, requiresReceipt, internalNotes, isPrimary)
-- - Migrate points -> locations (name->locationName, address->addressLine1, recipientName from name)
-- - reference: MC-{casePublicId}, copyable

-- Migrate old cash config (points) to locations
DO $$
DECLARE
  r RECORD;
  new_locations jsonb;
  pt jsonb;
  loc jsonb;
BEGIN
  FOR r IN
    SELECT tpc.id, tpc.config
    FROM tenant_payment_channels tpc
    JOIN payment_channel_types pct ON tpc.channel_type_id = pct.id
    WHERE pct.code = 'cash'
      AND tpc.config ? 'points'
      AND jsonb_typeof(tpc.config->'points') = 'array'
      AND NOT (tpc.config ? 'locations')
  LOOP
    new_locations := '[]'::jsonb;
    FOR pt IN SELECT * FROM jsonb_array_elements(r.config->'points')
    LOOP
      loc := jsonb_build_object(
        'locationName', coalesce(pt->>'name', 'Location'),
        'recipientName', coalesce(pt->>'name', 'Pay to'),
        'addressLine1', coalesce(pt->>'address', ''),
        'addressLine2', '',
        'city', '',
        'state', '',
        'zip', '',
        'hours', coalesce(pt->>'hours', ''),
        'phone', '',
        'instructions', coalesce(pt->>'instructions', ''),
        'requiresReceipt', false,
        'isPrimary', jsonb_array_length(new_locations) = 0
      );
      new_locations := new_locations || jsonb_build_array(loc);
    END LOOP;
    IF jsonb_array_length(new_locations) > 0 THEN
      UPDATE tenant_payment_channels
      SET config = (config - 'points') || jsonb_build_object('locations', new_locations)
      WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

-- Update cash config_schema
UPDATE payment_channel_types
SET config_schema = '{
  "fields": [
    {
      "key": "locations",
      "type": "array",
      "label": "Cash payment locations",
      "required": true,
      "minItems": 1,
      "requireExactlyOnePrimary": true,
      "copyable": true,
      "itemFields": [
        {"key": "locationName", "type": "string", "label": "Location name", "required": true, "copyable": true, "scope": "debtor"},
        {"key": "recipientName", "type": "string", "label": "Pay to (recipient)", "required": true, "copyable": true, "scope": "debtor"},
        {"key": "addressLine1", "type": "string", "label": "Address line 1", "required": true, "copyable": true, "scope": "debtor"},
        {"key": "addressLine2", "type": "string", "label": "Address line 2", "required": false, "copyable": true, "scope": "debtor"},
        {"key": "city", "type": "string", "label": "City", "required": true, "copyable": true, "scope": "debtor"},
        {"key": "state", "type": "string", "label": "State", "required": true, "copyable": true, "validation": {"pattern": "^[A-Z]{2}$"}, "hint": "2-letter state code (e.g. CA, FL)", "scope": "debtor"},
        {"key": "zip", "type": "string", "label": "ZIP code", "required": true, "copyable": true, "validation": {"pattern": "^[0-9]{5}(-[0-9]{4})?$"}, "hint": "e.g. 94105 or 94105-1234", "scope": "debtor"},
        {"key": "hours", "type": "text", "label": "Hours", "required": false, "hint": "e.g. Mon–Fri 9am–5pm", "scope": "debtor"},
        {"key": "phone", "type": "string", "label": "Phone (optional)", "required": false, "copyable": true, "hint": "e.g. +1...", "scope": "debtor"},
        {"key": "instructions", "type": "text", "label": "Instructions", "required": false, "scope": "debtor"},
        {"key": "requiresReceipt", "type": "boolean", "label": "Always request a receipt", "required": false, "scope": "debtor", "reminderWhenTrue": "Request a receipt when paying"},
        {"key": "internalNotes", "type": "text", "label": "Internal notes", "required": false, "scope": "tenant_admin"},
        {"key": "isPrimary", "type": "boolean", "label": "Primary (show to debtor)", "required": true, "scope": "tenant_admin"}
      ]
    }
  ],
  "reference": {
    "required": true,
    "copyable": true,
    "label": "Payment reference code",
    "template": "MC-{casePublicId}",
    "helpText": "Show this code when paying so we can apply your payment correctly. Ask for a receipt.",
    "placeholders": ["caseId", "casePublicId", "debtorId", "tenantId", "leaseExternalId"]
  }
}'::jsonb
WHERE code = 'cash';
