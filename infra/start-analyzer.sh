#!/usr/bin/env bash
set -euo pipefail

: "${BUILD:=1}"
: "${RECREATE:=1}"
: "${NO_CACHE:=0}"
: "${FOLLOW_LOGS:=0}"
: "${REMOVE_ORPHANS:=0}"

green()  { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
red()    { printf "\033[31m%s\033[0m\n" "$*"; }

resolve_root() {
  if [[ "${1-}" != "" ]]; then
    (cd "$1" && pwd)
    return
  fi

  if command -v git >/dev/null 2>&1 && git rev-parse --show-toplevel >/dev/null 2>&1; then
    git rev-parse --show-toplevel
    return
  fi

  local dir="$PWD"
  while [[ "$dir" != "/" ]]; do
    if [[ -f "$dir/infra/docker-compose.app.yml" ]]; then
      echo "$dir"
      return
    fi
    dir="$(dirname "$dir")"
  done

  echo "ERROR: Could not locate repo root. Expected infra/docker-compose.app.yml." >&2
  exit 1
}

wait_for_http() {
  local url="$1"
  local attempts="${2:-60}"

  for i in $(seq 1 "$attempts"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  return 1
}

REPO_ROOT="$(resolve_root "${1-}")"
INFRA_DIR="$REPO_ROOT/infra"
APP_COMPOSE="$INFRA_DIR/docker-compose.app.yml"
ENV_FILE="$INFRA_DIR/.env"

[[ -f "$APP_COMPOSE" ]] || { red "Compose file not found: $APP_COMPOSE"; exit 1; }
[[ -f "$ENV_FILE" ]] || { red "Env file not found: $ENV_FILE"; exit 1; }

docker network create infra_default >/dev/null 2>&1 || true

COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$APP_COMPOSE")

ANALYZER_PORT="$(grep -E '^DISPATCH_SCAN_ANALYZER_PORT=' "$ENV_FILE" | head -n1 | cut -d= -f2 || true)"
ANALYZER_PORT="${ANALYZER_PORT:-8091}"

UP_ARGS=(up -d)

if [[ "$BUILD" == "1" ]]; then
  UP_ARGS+=(--build)
fi

if [[ "$RECREATE" == "1" ]]; then
  UP_ARGS+=(--force-recreate)
fi

if [[ "$REMOVE_ORPHANS" == "1" ]]; then
  UP_ARGS+=(--remove-orphans)
fi

UP_ARGS+=(dispatch-slip-analyzer)

echo "Starting dispatch slip analyzer..."

if [[ "$NO_CACHE" == "1" ]]; then
  COMPOSE_IGNORE_ORPHANS=true "${COMPOSE[@]}" build --no-cache dispatch-slip-analyzer
fi

COMPOSE_IGNORE_ORPHANS=true "${COMPOSE[@]}" "${UP_ARGS[@]}" >/dev/null

if wait_for_http "http://127.0.0.1:${ANALYZER_PORT}/health" 60; then
  green "Analyzer started: http://127.0.0.1:${ANALYZER_PORT}"
  curl -fsS "http://127.0.0.1:${ANALYZER_PORT}/health" || true
  echo
else
  red "Analyzer failed to become healthy."
  echo
  "${COMPOSE[@]}" ps dispatch-slip-analyzer || true
  echo
  "${COMPOSE[@]}" logs --tail=80 dispatch-slip-analyzer || true
  exit 1
fi

if [[ "$FOLLOW_LOGS" == "1" ]]; then
  "${COMPOSE[@]}" logs -f --tail=100 dispatch-slip-analyzer
fi
