#!/usr/bin/env bash
set -euo pipefail

# ───────────── config ─────────────
: "${IMPORT_DUMP:=1}"
: "${DB_LOGS:=0}"
: "${FOLLOW_ALERT:=1}"
: "${TAIL_LINES:=200}"

DUMP_FILE="data.DMP"

# ───────────── pretty helpers ─────────────
bold()  { printf "\033[1m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
yellow(){ printf "\033[33m%s\033[0m\n" "$*"; }
red()   { printf "\033[31m%s\033[0m\n" "$*"; }
ts()    { date +"%Y-%m-%d %H:%M:%S"; }
log()   { printf "[%s] %s\n" "$(ts)" "$*"; }
step()  { echo; bold "==> $*"; }
section(){ echo; bold "──────── $* ────────"; }

# ───────────── repo detection ─────────────
resolve_root() {
  if [[ "${1-}" != "" ]]; then (cd "$1" && pwd) && return; fi
  if command -v git >/dev/null 2>&1 && git rev-parse --show-toplevel >/dev/null 2>&1; then
    git rev-parse --show-toplevel; return
  fi
  local dir="$PWD"
  while [[ "$dir" != "/" ]]; do
    if [[ -f "$dir/infra/docker-compose.db.yml" && -f "$dir/infra/docker-compose.app.yml" ]]; then
      echo "$dir"; return
    fi
    dir="$(dirname "$dir")"
  done
  echo "ERROR: Could not locate repo root (looking for infra/docker-compose.*.yml)." >&2
  exit 1
}

REPO_ROOT="$(resolve_root "${1-}")"
cd "$REPO_ROOT"
DB_COMPOSE="$REPO_ROOT/infra/docker-compose.db.yml"
APP_COMPOSE="$REPO_ROOT/infra/docker-compose.app.yml"

section "START"
log "Using REPO_ROOT: $REPO_ROOT"
log "DB compose     : $DB_COMPOSE"
log "APP compose    : $APP_COMPOSE"

if [[ ! -f "$DB_COMPOSE" || ! -f "$APP_COMPOSE" ]]; then
  red "Compose files not found"; exit 1
fi

# ───────────── cleanup ─────────────
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

# ───────────── helpers ─────────────
wait_for_oracle() {
  local cname="infra-oracle-xe-1"
  step "Waiting for Oracle container ($cname) to be healthy..."
  for _ in {1..60}; do
    local status
    status="$(docker inspect -f '{{json .State.Health.Status}}' "$cname" 2>/dev/null || echo '"starting"')"
    if [[ "$status" == "\"healthy\"" ]]; then
      green "Oracle is healthy."
      return 0
    fi
    sleep 3
  done
  red "Oracle did not become healthy in time."; return 1
}

follow_oracle_alert() {
  local cname="infra-oracle-xe-1"
  local alert="/opt/oracle/diag/rdbms/xe/XE/trace/alert_XE.log"
  step "Following Oracle alert log (Ctrl+C to stop all)…"
  docker exec -i "$cname" bash -lc '
    f="'"$alert"'"
    for i in {1..60}; do [[ -f "$f" ]] && break; sleep 1; done
    [[ -f "$f" ]] && tail -n '"$TAIL_LINES"' -f "$f" || echo "alert_XE.log not found"
  ' &
  PIDS+=($!)
}

follow_container_logs() {
  local cname="$1"
  step "Following container logs: $cname"
  docker logs -f --tail="$TAIL_LINES" "$cname" &
  PIDS+=($!)
}

# ───────────── 1) stop ─────────────
section "1) Stop ALL stacks (app + db) and remove orphans/anonymous volumes"
docker compose -f "$APP_COMPOSE" down --volumes --remove-orphans || true
docker compose -f "$DB_COMPOSE"  down --volumes --remove-orphans || true

# ───────────── 2) start DB ─────────────
section "2) Start DB stack (Oracle + Postgres)"
docker compose -f "$DB_COMPOSE" up -d --build oracle-xe postgres
wait_for_oracle

if [[ "$DB_LOGS" == "1" ]]; then
  follow_container_logs infra-oracle-xe-1
  follow_container_logs infra-postgres-1
fi
if [[ "$FOLLOW_ALERT" == "1" ]]; then
  follow_oracle_alert
fi

# ───────────── 3) ensure user ─────────────
section "3) Ensure IN_WPRG user (idempotent)"
docker compose -f "$DB_COMPOSE" up --no-deps --build --abort-on-container-exit --exit-code-from oracle-ensure-user oracle-ensure-user || true

# ───────────── 4) import dump ─────────────
if [[ "$IMPORT_DUMP" == "1" ]]; then
  DUMP_PATH="$REPO_ROOT/infra/oracle/dumps/$DUMP_FILE"
  if [[ -f "$DUMP_PATH" ]]; then
    section "4) Import Data Pump dump: $DUMP_FILE"
    docker compose -f "$DB_COMPOSE" run --rm oracle-impdp

    section "Post-import validation"
    docker exec -i infra-oracle-xe-1 bash -lc '
sqlplus -s system/$ORACLE_PASSWORD@localhost:1521/XE <<SQL
SET HEADING ON FEEDBACK OFF VERIFY OFF ECHO OFF PAGES 200 LINES 200 TRIMS ON
COLUMN OWNER FORMAT A10
COLUMN NAME  FORMAT A30
COLUMN TYPE  FORMAT A20
COLUMN TEXT  FORMAT A80

PROMPT -> Invalid objects in IN_WPRG:
SELECT COUNT(*) AS invalid_cnt
FROM dba_objects
WHERE owner = '\''IN_WPRG'\'' AND status <> '\''VALID'\'';

PROMPT
PROMPT -> First 20 compile errors (if any):
SELECT * FROM (
  SELECT owner, name, type, line, position, text
  FROM dba_errors
  WHERE owner = '\''IN_WPRG'\''
  ORDER BY name, sequence
) WHERE ROWNUM <= 20;
EXIT
SQL
' || true
  else
    section "4) Import Data Pump dump: $DUMP_FILE"
    echo "Info: $DUMP_PATH not found — skipping import."
  fi
else
  section "4) Import Data Pump dump"
  echo "Info: IMPORT_DUMP=0 — skipping import."
fi

# ───────────── 5) start APP ─────────────
section "5) Start APP stack"
docker compose -f "$APP_COMPOSE" up -d --build

# ───────────── 6) status ─────────────
section "6) Show status"
log "== DB stack =="
docker compose -f "$DB_COMPOSE" ps || true
log "== APP stack =="
docker compose -f "$APP_COMPOSE" ps || true

if ! docker ps --format '{{.Names}}' | grep -q '^infra-oracle-xe-1$'; then
  red "oracle-xe container not running; check Compose files (avoid --remove-orphans on app)."
fi
if ! docker ps --format '{{.Names}}' | grep -q '^infra-postgres-1$'; then
  red "postgres container not running; check Compose files."
fi

# ───────────── 7) follow app logs ─────────────
section "7) Follow app logs (all services in app compose; Ctrl+C to stop)"
docker compose -f "$APP_COMPOSE" logs -f --tail="$TAIL_LINES" &
PIDS+=($!)

app_services="$(docker compose -f "$APP_COMPOSE" config --services)"
bad=$(docker compose -f "$APP_COMPOSE" ps --status=exited --services \
      | grep -Fxf <(printf "%s\n" "$app_services") || true)
if [[ -n "${bad:-}" ]]; then
  red "Detected exited app service(s): $bad"
  docker compose -f "$APP_COMPOSE" logs --tail="$TAIL_LINES" $bad || true
fi

wait
