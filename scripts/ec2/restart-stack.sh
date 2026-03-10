#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${1:-/home/ubuntu/docker-compose.yml}"
WORKERS_DIR="${WORKERS_DIR:-/home/ubuntu/mordecai-workers}"
REFRESH_WORKERS_API_DEP="${REFRESH_WORKERS_API_DEP:-1}"
SERVICES_TO_BUILD="${SERVICES_TO_BUILD:-mordecai-api mordecai-workers}"

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "ERROR: compose file not found: $COMPOSE_FILE" >&2
  exit 1
fi

if command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
elif docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker compose)
else
  echo "ERROR: neither docker-compose nor docker compose is available." >&2
  exit 1
fi

STACK_DIR="$(cd "$(dirname "$COMPOSE_FILE")" && pwd)"
echo "Using compose file: $COMPOSE_FILE"
echo "Working directory: $STACK_DIR"

refresh_workers_api_dependency() {
  if [[ "$REFRESH_WORKERS_API_DEP" != "1" ]]; then
    echo "Skipping worker dependency refresh (REFRESH_WORKERS_API_DEP=$REFRESH_WORKERS_API_DEP)"
    return
  fi

  if [[ ! -f "$WORKERS_DIR/package.json" ]]; then
    echo "Skipping worker dependency refresh: package.json not found in $WORKERS_DIR"
    return
  fi

  local dep_spec
  dep_spec="$(
    node -e '
      const fs = require("fs");
      const pkg = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
      process.stdout.write((pkg.dependencies && pkg.dependencies["mordcai-api"]) || "");
    ' "$WORKERS_DIR/package.json"
  )"

  if [[ -z "$dep_spec" ]]; then
    echo "Skipping worker dependency refresh: mordcai-api dependency not found in $WORKERS_DIR/package.json"
    return
  fi

  # If the worker depends on a Git ref, refresh lockfile to latest commit in that ref
  # so docker build does not keep an old pinned commit.
  if [[ "$dep_spec" == git+* || "$dep_spec" == github:* || "$dep_spec" == https://* ]]; then
    echo "Refreshing mordcai-api dependency lock in $WORKERS_DIR ($dep_spec)"
    (
      cd "$WORKERS_DIR"
      npm install --package-lock-only "mordcai-api@$dep_spec"
    )
  else
    echo "mordcai-api dependency is '$dep_spec' (non-git). Lock refresh step not required."
  fi
}

cd "$STACK_DIR"

refresh_workers_api_dependency

"${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" down --remove-orphans
docker system prune -f
"${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" build --pull --no-cache $SERVICES_TO_BUILD
"${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" up -d --force-recreate
"${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" ps
