-- Add hint to Beneficiary / Account holder in transfer bank accounts
-- Explains that it's the name on the account that receives the payment

UPDATE payment_channel_types
SET config_schema = jsonb_set(
  config_schema,
  '{fields,0,itemFields,0}',
  (config_schema->'fields'->0->'itemFields'->0) || '{"hint": "Name on the bank account that receives the payment. Residents must enter this exactly when making a wire or ACH transfer."}'::jsonb
)
WHERE code = 'transfer';
