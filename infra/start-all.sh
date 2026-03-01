#!/usr/bin/env bash
set -euo pipefail

: "${IMPORT_DUMP:=0}"
: "${RESET_DB:=0}"
: "${DB_LOGS:=0}"
: "${APP_LOGS:=1}"
: "${TAIL_LINES:=200}"

DUMP_FILE="data.DMP"

bold()   { printf "\033[1m%s\033[0m\n" "$*"; }
green()  { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
red()    { printf "\033[31m%s\033[0m\n" "$*"; }
ts()     { date +"%Y-%m-%d %H:%M:%S"; }
log()    { printf "[%s] %s\n" "$(ts)" "$*"; }
step()   { echo; bold "==> $*"; }
section(){ echo; bold "──────── $* ────────"; }

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
    if [[ -f "$dir/infra/docker-compose.db.yml" && -f "$dir/infra/docker-compose.app.yml" ]]; then
      echo "$dir"
      return
    fi
    dir="$(dirname "$dir")"
  done

  echo "ERROR: Could not locate repo root (looking for infra/docker-compose.*.yml)." >&2
  exit 1
}

REPO_ROOT="$(resolve_root "${1-}")"
INFRA_DIR="$REPO_ROOT/infra"
DB_COMPOSE="$INFRA_DIR/docker-compose.db.yml"
APP_COMPOSE="$INFRA_DIR/docker-compose.app.yml"
ENV_FILE="$INFRA_DIR/.env"

section "START ALL"
log "Using REPO_ROOT : $REPO_ROOT"
log "Using INFRA_DIR : $INFRA_DIR"
log "DB compose      : $DB_COMPOSE"
log "APP compose     : $APP_COMPOSE"
log "Env file        : $ENV_FILE"

[[ -f "$DB_COMPOSE" ]] || { red "DB compose file not found: $DB_COMPOSE"; exit 1; }
[[ -f "$APP_COMPOSE" ]] || { red "App compose file not found: $APP_COMPOSE"; exit 1; }
[[ -f "$ENV_FILE" ]] || { red "Env file not found: $ENV_FILE"; exit 1; }

docker network create infra_default >/dev/null 2>&1 || true

DBC=(docker compose --env-file "$ENV_FILE" -f "$DB_COMPOSE")
APPC=(docker compose --env-file "$ENV_FILE" -f "$APP_COMPOSE")

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
  local compose_name="$1"
  local service="$2"

  if [[ "$compose_name" == "db" ]]; then
    "${DBC[@]}" ps -q "$service" 2>/dev/null | head -n 1
  else
    "${APPC[@]}" ps -q "$service" 2>/dev/null | head -n 1
  fi
}

wait_for_service_healthy() {
  local compose_name="$1"
  local service="$2"
  local label="$3"
  local attempts="$4"
  local sleep_seconds="$5"

  step "Waiting for $label ($service) to be healthy..."

  for _ in $(seq 1 "$attempts"); do
    local cid
    cid="$(get_container_id "$compose_name" "$service")"

    if [[ -n "$cid" ]]; then
      local status
      status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid" 2>/dev/null || echo starting)"
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

follow_logs() {
  local compose_name="$1"
  local service="$2"

  step "Following logs for $compose_name/$service"
  if [[ "$compose_name" == "db" ]]; then
    "${DBC[@]}" logs -f --tail="$TAIL_LINES" "$service" &
  else
    "${APPC[@]}" logs -f --tail="$TAIL_LINES" "$service" &
  fi
  PIDS+=($!)
}

service_exists() {
  local compose_name="$1"
  local service="$2"

  if [[ "$compose_name" == "db" ]]; then
    "${DBC[@]}" config --services | grep -Fxq "$service"
  else
    "${APPC[@]}" config --services | grep -Fxq "$service"
  fi
}

section "1) Stop stacks"
if [[ "$RESET_DB" == "1" ]]; then
  yellow "RESET_DB=1 -> removing DB volumes too"
  "${APPC[@]}" down || true
  "${DBC[@]}" down --volumes || true
else
  "${APPC[@]}" down || true
  "${DBC[@]}" down || true
fi

section "2) Start DB stack (Oracle + Postgres)"
"${DBC[@]}" up -d --build oracle-xe postgres

wait_for_service_healthy "db" "oracle-xe" "Oracle" 120 3
wait_for_service_healthy "db" "postgres" "Postgres" 60 2

if [[ "$DB_LOGS" == "1" ]]; then
  follow_logs "db" "oracle-xe"
  follow_logs "db" "postgres"
fi

if [[ "$IMPORT_DUMP" == "1" ]]; then
  DUMP_PATH="$INFRA_DIR/oracle/dumps/$DUMP_FILE"
  section "3) Import Data Pump dump: $DUMP_FILE"

  if service_exists "db" "oracle-impdp" && [[ -f "$DUMP_PATH" ]]; then
    log "Found dump file: $DUMP_PATH"
    "${DBC[@]}" run --rm oracle-impdp
  elif ! service_exists "db" "oracle-impdp"; then
    yellow "Service oracle-impdp does not exist — skipping import."
  else
    yellow "Dump file not found: $DUMP_PATH — skipping import."
  fi
else
  section "3) Import Data Pump dump"
  log "IMPORT_DUMP=0 — skipping import."
fi

section "4) Start APP stack"
"${APPC[@]}" up -d --build

section "5) Show status"
log "== DB stack =="
"${DBC[@]}" ps || true

log "== APP stack =="
"${APPC[@]}" ps || true

section "6) App quick check"
APP_PORT="$(grep -E '^QUARKUS_HTTP_PORT=' "$ENV_FILE" | head -n1 | cut -d= -f2 || true)"
APP_PORT="${APP_PORT:-8080}"

# Give Quarkus a moment to come up before checking
sleep 5

if curl -fsS "http://127.0.0.1:${APP_PORT}/q/health" >/dev/null 2>&1; then
  green "App health check passed on http://127.0.0.1:${APP_PORT}/q/health"
else
  yellow "App health check failed on http://127.0.0.1:${APP_PORT}/q/health"
fi

if [[ "$APP_LOGS" == "1" ]]; then
  section "7) Follow app logs (Ctrl+C to stop)"
  "${APPC[@]}" logs -f --tail="$TAIL_LINES" &
  PIDS+=($!)
  wait
fi