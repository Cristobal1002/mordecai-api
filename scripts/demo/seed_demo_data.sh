#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  ./scripts/demo/seed_demo_data.sh [options]

Required DB env vars:
  DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD

Options:
  --tenant-name "Demo PM"
  --debtor-name "Andres Cristobal Sosa"
  --debtor-email "andres@example.com"
  --debtor-phone "+573001112233"
  --amount-usd 5000
  --days-past-due 12
  --due-date 2026-02-20
  --output ./demo_ids_20260213_170000.txt
  --help
EOF
}

require_env() {
  local var_name="$1"
  if [[ -z "${!var_name:-}" ]]; then
    echo "ERROR: missing required env var: $var_name" >&2
    exit 1
  fi
}

new_uuid() {
  if command -v uuidgen >/dev/null 2>&1; then
    uuidgen | tr '[:upper:]' '[:lower:]'
    return
  fi

  # Fallback (Linux kernel UUID source)
  if [[ -r /proc/sys/kernel/random/uuid ]]; then
    cat /proc/sys/kernel/random/uuid
    return
  fi

  echo "ERROR: cannot generate UUID (uuidgen not found and /proc uuid unavailable)" >&2
  exit 1
}

require_env DB_HOST
require_env DB_PORT
require_env DB_NAME
require_env DB_USER
require_env DB_PASSWORD

TENANT_NAME="Mordecai Demo Tenant"
DEBTOR_NAME="Andres Cristobal Sosa"
DEBTOR_EMAIL="andres.demo@example.com"
DEBTOR_PHONE="+573001112233"
AMOUNT_USD=5000
DAYS_PAST_DUE=12
DUE_DATE="$(date -u +%F)"
OUTPUT_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tenant-name)
      TENANT_NAME="$2"
      shift 2
      ;;
    --debtor-name)
      DEBTOR_NAME="$2"
      shift 2
      ;;
    --debtor-email)
      DEBTOR_EMAIL="$2"
      shift 2
      ;;
    --debtor-phone)
      DEBTOR_PHONE="$2"
      shift 2
      ;;
    --amount-usd)
      AMOUNT_USD="$2"
      shift 2
      ;;
    --days-past-due)
      DAYS_PAST_DUE="$2"
      shift 2
      ;;
    --due-date)
      DUE_DATE="$2"
      shift 2
      ;;
    --output)
      OUTPUT_FILE="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "ERROR: unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if ! [[ "$AMOUNT_USD" =~ ^[0-9]+([.][0-9]{1,2})?$ ]]; then
  echo "ERROR: --amount-usd must be numeric (e.g. 5000 or 5000.50)" >&2
  exit 1
fi

if ! [[ "$DAYS_PAST_DUE" =~ ^[0-9]+$ ]]; then
  echo "ERROR: --days-past-due must be an integer >= 0" >&2
  exit 1
fi

if [[ -z "$OUTPUT_FILE" ]]; then
  OUTPUT_FILE="./demo_ids_$(date -u +%Y%m%d_%H%M%S).txt"
fi

TENANT_ID="$(new_uuid)"
DEBTOR_ID="$(new_uuid)"
DEBT_CASE_ID="$(new_uuid)"
FLOW_POLICY_ID_1="$(new_uuid)"
FLOW_POLICY_ID_2="$(new_uuid)"
FLOW_POLICY_ID_3="$(new_uuid)"

AMOUNT_CENTS="$(python3 - <<PY
import decimal
value = decimal.Decimal("$AMOUNT_USD")
print(int(value * 100))
PY
)"

if (( DAYS_PAST_DUE <= 5 )); then
  FLOW_POLICY_ID="$FLOW_POLICY_ID_1"
elif (( DAYS_PAST_DUE <= 20 )); then
  FLOW_POLICY_ID="$FLOW_POLICY_ID_2"
else
  FLOW_POLICY_ID="$FLOW_POLICY_ID_3"
fi

export PGPASSWORD="$DB_PASSWORD"

psql \
  --host "$DB_HOST" \
  --port "$DB_PORT" \
  --username "$DB_USER" \
  --dbname "$DB_NAME" \
  -v ON_ERROR_STOP=1 \
  -v tenant_id="$TENANT_ID" \
  -v debtor_id="$DEBTOR_ID" \
  -v debt_case_id="$DEBT_CASE_ID" \
  -v flow_policy_id_1="$FLOW_POLICY_ID_1" \
  -v flow_policy_id_2="$FLOW_POLICY_ID_2" \
  -v flow_policy_id_3="$FLOW_POLICY_ID_3" \
  -v flow_policy_id="$FLOW_POLICY_ID" \
  -v tenant_name="$TENANT_NAME" \
  -v debtor_name="$DEBTOR_NAME" \
  -v debtor_email="$DEBTOR_EMAIL" \
  -v debtor_phone="$DEBTOR_PHONE" \
  -v amount_due_cents="$AMOUNT_CENTS" \
  -v days_past_due="$DAYS_PAST_DUE" \
  -v due_date="$DUE_DATE" \
  <<'SQL'
BEGIN;

INSERT INTO tenants (id, name, timezone, status, settings, created_at, updated_at)
VALUES (
  :'tenant_id',
  :'tenant_name',
  'America/New_York',
  'active',
  '{"demo":true}'::jsonb,
  now(),
  now()
);

INSERT INTO flow_policies (
  id, tenant_id, name, min_days_past_due, max_days_past_due, channels, tone, rules, is_active, created_at, updated_at
)
VALUES
  (
    :'flow_policy_id_1',
    :'tenant_id',
    'Demo 1-5 days',
    1,
    5,
    '{"sms":true,"email":true,"call":true,"whatsapp":false}'::jsonb,
    'friendly',
    '{"min_upfront_pct":25,"half_pct":50,"max_installments":4}'::jsonb,
    true,
    now(),
    now()
  ),
  (
    :'flow_policy_id_2',
    :'tenant_id',
    'Demo 6-20 days',
    6,
    20,
    '{"sms":true,"email":true,"call":true,"whatsapp":false}'::jsonb,
    'professional',
    '{"min_upfront_pct":25,"half_pct":50,"max_installments":4}'::jsonb,
    true,
    now(),
    now()
  ),
  (
    :'flow_policy_id_3',
    :'tenant_id',
    'Demo 21+ days',
    21,
    NULL,
    '{"sms":true,"email":true,"call":true,"whatsapp":false}'::jsonb,
    'firm',
    '{"min_upfront_pct":30,"half_pct":50,"max_installments":4}'::jsonb,
    true,
    now(),
    now()
  );

INSERT INTO debtors (
  id, tenant_id, full_name, email, phone, metadata, created_at, updated_at
)
VALUES (
  :'debtor_id',
  :'tenant_id',
  :'debtor_name',
  :'debtor_email',
  :'debtor_phone',
  '{"notes":"Synthetic demo debtor","balance_type":"rent"}'::jsonb,
  now(),
  now()
);

INSERT INTO debt_cases (
  id,
  tenant_id,
  debtor_id,
  flow_policy_id,
  amount_due_cents,
  currency,
  days_past_due,
  due_date,
  status,
  next_action_at,
  meta,
  created_at,
  updated_at
)
VALUES (
  :'debt_case_id',
  :'tenant_id',
  :'debtor_id',
  :'flow_policy_id',
  :'amount_due_cents'::bigint,
  'USD',
  :'days_past_due'::int,
  :'due_date',
  'NEW',
  now(),
  jsonb_build_object(
    'notes', 'Synthetic demo case',
    'lease_id', 'LEASE-DEMO-001',
    'balance_type', 'rent',
    'customer_name', :'debtor_name',
    'balance_amount', (:'amount_due_cents'::bigint / 100)::text,
    'balance_amount_cents', :'amount_due_cents'
  ),
  now(),
  now()
);

COMMIT;
SQL

cat > "$OUTPUT_FILE" <<EOF
TENANT_ID=$TENANT_ID
DEBTOR_ID=$DEBTOR_ID
DEBT_CASE_ID=$DEBT_CASE_ID
FLOW_POLICY_ID_1=$FLOW_POLICY_ID_1
FLOW_POLICY_ID_2=$FLOW_POLICY_ID_2
FLOW_POLICY_ID_3=$FLOW_POLICY_ID_3
FLOW_POLICY_ID_USED=$FLOW_POLICY_ID
EOF

echo ""
echo "Demo data created successfully:"
echo "  TENANT_ID          : $TENANT_ID"
echo "  DEBTOR_ID          : $DEBTOR_ID"
echo "  DEBT_CASE_ID       : $DEBT_CASE_ID"
echo "  FLOW_POLICY_ID_USED: $FLOW_POLICY_ID"
echo "  IDs file           : $OUTPUT_FILE"
