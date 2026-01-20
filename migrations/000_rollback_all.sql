-- Rollback: Drop all tables and types in reverse order
-- WARNING: This will delete all data!

-- Drop tables (reverse order of creation)
DROP TABLE IF EXISTS interaction_logs CASCADE;
DROP TABLE IF EXISTS payment_agreements CASCADE;
DROP TABLE IF EXISTS debt_cases CASCADE;
DROP TABLE IF EXISTS import_batches CASCADE;
DROP TABLE IF EXISTS flow_policies CASCADE;
DROP TABLE IF EXISTS debtors CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;

-- Drop enum types
DROP TYPE IF EXISTS interaction_log_outcome CASCADE;
DROP TYPE IF EXISTS interaction_log_direction CASCADE;
DROP TYPE IF EXISTS interaction_log_type CASCADE;
DROP TYPE IF EXISTS payment_agreement_created_by CASCADE;
DROP TYPE IF EXISTS payment_agreement_provider CASCADE;
DROP TYPE IF EXISTS payment_agreement_status CASCADE;
DROP TYPE IF EXISTS payment_agreement_type CASCADE;
DROP TYPE IF EXISTS debt_case_status CASCADE;
DROP TYPE IF EXISTS import_batch_status CASCADE;
DROP TYPE IF EXISTS import_batch_source CASCADE;
DROP TYPE IF EXISTS tenant_status CASCADE;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

