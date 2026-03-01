#!/usr/bin/env bash
set -euo pipefail

: "${IMPORT_DUMP:=0}"
: "${RESET_DB:=0}"
: "${DB_LOGS:=0}"
: "${TAIL_LINES:=200}"
DUMP_FILE="data.DMP"

bold()   { printf "\033[1m%s\033[0m\n" "$*"; }
green()  { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
red()    { printf "\033[31m%s\033[0m\n" "$*"; }
ts()     { date +"%Y-%m-%d %H:%M:%S"; }
log()    { printf "[%s] %s\n" "$(ts)" "$*"; }
section(){ echo; bold "──────── $* ────────"; }
step()   { echo; bold "==> $*"; }

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
    if [[ -f "$dir/infra/docker-compose.db.yml" ]]; then
      echo "$dir"
      return
    fi
    dir="$(dirname "$dir")"
  done
  echo "ERROR: Could not locate repo root (looking for infra/docker-compose.db.yml)." >&2
  exit 1
}

REPO_ROOT="$(resolve_root "${1-}")"
INFRA_DIR="$REPO_ROOT/infra"
DB_COMPOSE="$INFRA_DIR/docker-compose.db.yml"
ENV_FILE="$INFRA_DIR/.env"

section "START DB"
log "Using REPO_ROOT : $REPO_ROOT"
log "Using INFRA_DIR : $INFRA_DIR"
log "DB compose      : $DB_COMPOSE"
log "Env file        : $ENV_FILE"

[[ -f "$DB_COMPOSE" ]] || { red "DB compose file not found: $DB_COMPOSE"; exit 1; }
[[ -f "$ENV_FILE" ]] || { red "Env file not found: $ENV_FILE"; exit 1; }

docker network create infra_default >/dev/null 2>&1 || true

COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$DB_COMPOSE")

PIDS=()
cleanup() {
  echo
  section "CLEANUP"
  if [[ ${#PIDS[@]} -gt 0 ]]; then
    log "Stopping background tails: ${PIDS[*]}"
    kill "${PIDS[@]}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

get_container_id() {
  local service="$1"
  "${COMPOSE[@]}" ps -q "$service" 2>/dev/null | head -n 1
}

wait_for_service_healthy() {
  local service="$1"
  local label="$2"
  local max_attempts="$3"
  local sleep_seconds="$4"

  step "Waiting for $label service ($service) to be healthy..."

  for _ in $(seq 1 "$max_attempts"); do
    local cid
    cid="$(get_container_id "$service")"
    if [[ -n "$cid" ]]; then
      local status
      status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid" 2>/dev/null || echo "starting")"
      if [[ "$status" == "healthy" ]]; then
        green "$label is healthy."
        return 0
      fi
    fi
    sleep "$sleep_seconds"
  done

  red "$label did not become healthy in time."
  return 1
}

follow_service_logs() {
  local service="$1"
  step "Following logs for service: $service"
  "${COMPOSE[@]}" logs -f --tail="$TAIL_LINES" "$service" &
  PIDS+=($!)
}

service_exists() {
  local service="$1"
  "${COMPOSE[@]}" config --services | grep -Fxq "$service"
}

section "1) Stop DB stack"
if [[ "$RESET_DB" == "1" ]]; then
  yellow "RESET_DB=1 -> removing DB volumes too"
  "${COMPOSE[@]}" down --volumes || true
else
  "${COMPOSE[@]}" down || true
fi

section "2) Start DB stack (Oracle + Postgres)"
"${COMPOSE[@]}" up -d --build oracle-xe postgres

wait_for_service_healthy "oracle-xe" "Oracle" 120 3
wait_for_service_healthy "postgres" "Postgres" 60 2

if [[ "$DB_LOGS" == "1" ]]; then
  follow_service_logs "oracle-xe"
  follow_service_logs "postgres"
fi

if [[ "$IMPORT_DUMP" == "1" ]]; then
  DUMP_PATH="$INFRA_DIR/oracle/dumps/$DUMP_FILE"
  section "3) Import Data Pump dump: $DUMP_FILE"

  if service_exists "oracle-impdp" && [[ -f "$DUMP_PATH" ]]; then
    log "Found dump file: $DUMP_PATH"
    "${COMPOSE[@]}" run --rm oracle-impdp
  elif ! service_exists "oracle-impdp"; then
    yellow "Service oracle-impdp not found — skipping import."
  else
    yellow "Dump file not found: $DUMP_PATH — skipping import."
  fi
else
  section "3) Import Data Pump dump"
  log "IMPORT_DUMP=0 — skipping import."
fi

section "4) Show DB stack status"
"${COMPOSE[@]}" ps || true

section "5) Quick checks"

if "${COMPOSE[@]}" exec -T postgres sh -lc 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" -h localhost' >/dev/null 2>&1; then
  green "Postgres pg_isready check passed."
else
  yellow "Postgres pg_isready check failed."
fi

if "${COMPOSE[@]}" exec -T oracle-xe bash -lc 'echo "select 1 from dual;" | sqlplus -s system/${ORACLE_PASSWORD}@//localhost:1521/XE | grep -q 1' >/dev/null 2>&1; then
  green "Oracle SQL check passed."
else
  yellow "Oracle SQL check failed."
fi

if [[ "$DB_LOGS" == "1" ]]; then
  section "6) Following DB logs (Ctrl+C to stop)"
  wait
fi