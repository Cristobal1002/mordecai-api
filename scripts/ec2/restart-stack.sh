#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${1:-/home/ubuntu/docker-compose.yml}"

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

cd "$STACK_DIR"

"${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" down --remove-orphans
docker system prune -f
"${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" up -d --build
"${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" ps
