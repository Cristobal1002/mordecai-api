#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  ./scripts/demo/cleanup_demo_data.sh --ids-file ./demo_ids_YYYYMMDD_HHMMSS.txt

Required DB env vars:
  DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
EOF
}

require_env() {
  local var_name="$1"
  if [[ -z "${!var_name:-}" ]]; then
    echo "ERROR: missing required env var: $var_name" >&2
    exit 1
  fi
}

IDS_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ids-file)
      IDS_FILE="$2"
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

if [[ -z "$IDS_FILE" ]]; then
  echo "ERROR: --ids-file is required" >&2
  usage
  exit 1
fi

if [[ ! -f "$IDS_FILE" ]]; then
  echo "ERROR: ids file not found: $IDS_FILE" >&2
  exit 1
fi

require_env DB_HOST
require_env DB_PORT
require_env DB_NAME
require_env DB_USER
require_env DB_PASSWORD

TENANT_ID="$(grep '^TENANT_ID=' "$IDS_FILE" | head -n1 | cut -d= -f2- || true)"

if [[ -z "$TENANT_ID" ]]; then
  echo "ERROR: TENANT_ID was not found in $IDS_FILE" >&2
  exit 1
fi

export PGPASSWORD="$DB_PASSWORD"

psql \
  --host "$DB_HOST" \
  --port "$DB_PORT" \
  --username "$DB_USER" \
  --dbname "$DB_NAME" \
  -v ON_ERROR_STOP=1 \
  -v tenant_id="$TENANT_ID" \
  <<'SQL'
BEGIN;

DELETE FROM interaction_logs WHERE tenant_id = :'tenant_id';
DELETE FROM payment_agreements WHERE tenant_id = :'tenant_id';
DELETE FROM debt_cases WHERE tenant_id = :'tenant_id';
DELETE FROM debtors WHERE tenant_id = :'tenant_id';
DELETE FROM flow_policies WHERE tenant_id = :'tenant_id';
DELETE FROM import_batches WHERE tenant_id = :'tenant_id';
DELETE FROM tenant_invitations WHERE tenant_id = :'tenant_id';
DELETE FROM tenant_users WHERE tenant_id = :'tenant_id';
DELETE FROM tenants WHERE id = :'tenant_id';

COMMIT;
SQL

echo "Demo data removed successfully for TENANT_ID=$TENANT_ID"
