-- Rename payeeInternalNotes -> internalNotes in check payment channel configs
-- (Consistency with other channels; scope controls visibility)

UPDATE tenant_payment_channels tpc
SET config = tpc.config - 'payeeInternalNotes' || jsonb_build_object('internalNotes', tpc.config->'payeeInternalNotes')
FROM payment_channel_types pct
WHERE tpc.channel_type_id = pct.id
  AND pct.code = 'check'
  AND tpc.config ? 'payeeInternalNotes';
