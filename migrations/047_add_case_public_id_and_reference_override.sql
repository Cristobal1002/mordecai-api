-- Migration: case_public_id for short memo reference + referenceOverride support
-- case_public_id: short ID (MC-4F2K9Q) recommended for memo, nicer than full UUID

-- Add case_public_id to debt_cases
ALTER TABLE debt_cases
ADD COLUMN IF NOT EXISTS case_public_id VARCHAR(16) UNIQUE;

CREATE INDEX IF NOT EXISTS idx_debt_cases_case_public_id ON debt_cases(case_public_id);

-- Backfill existing rows with generated short IDs
DO $$
DECLARE
  r RECORD;
  new_id TEXT;
  done INT := 0;
BEGIN
  FOR r IN SELECT id FROM debt_cases WHERE case_public_id IS NULL
  LOOP
    LOOP
      new_id := 'MC-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || r.id::TEXT) FROM 1 FOR 6));
      BEGIN
        UPDATE debt_cases SET case_public_id = new_id WHERE id = r.id;
        done := done + 1;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        NULL; -- retry with new random
      END;
    END LOOP;
  END LOOP;
  RAISE NOTICE 'Backfilled % debt_cases with case_public_id', done;
END $$;

-- Default for new rows: trigger to generate on insert
CREATE OR REPLACE FUNCTION generate_case_public_id()
RETURNS TRIGGER AS $$
DECLARE
  new_id TEXT;
BEGIN
  IF NEW.case_public_id IS NULL OR NEW.case_public_id = '' THEN
    LOOP
      new_id := 'MC-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NEW.id::TEXT) FROM 1 FOR 6));
      IF NOT EXISTS (SELECT 1 FROM debt_cases WHERE case_public_id = new_id) THEN
        NEW.case_public_id := new_id;
        EXIT;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_debt_cases_generate_case_public_id ON debt_cases;
CREATE TRIGGER trg_debt_cases_generate_case_public_id
  BEFORE INSERT ON debt_cases
  FOR EACH ROW
  EXECUTE FUNCTION generate_case_public_id();

COMMENT ON COLUMN debt_cases.case_public_id IS 'Short public ID (e.g. MC-4F2K9Q) for memo/reference. Recommended over full UUID in debtor-facing display.';
