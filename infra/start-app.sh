#!/usr/bin/env bash
set -euo pipefail

: "${TAIL_LINES:=200}"
: "${FOLLOW_LOGS:=1}"

bold()   { printf "\033[1m%s\033[0m\n" "$*"; }
green()  { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
red()    { printf "\033[31m%s\033[0m\n" "$*"; }
log()    { printf "[%s] %s\n" "$(date +"%Y-%m-%d %H:%M:%S")" "$*"; }
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
    if [[ -f "$dir/infra/docker-compose.app.yml" ]]; then
      echo "$dir"
      return
    fi
    dir="$(dirname "$dir")"
  done
  echo "ERROR: Could not locate repo root (looking for infra/docker-compose.app.yml)." >&2
  exit 1
}

REPO_ROOT="$(resolve_root "${1-}")"
INFRA_DIR="$REPO_ROOT/infra"
APP_COMPOSE="$INFRA_DIR/docker-compose.app.yml"
ENV_FILE="$INFRA_DIR/.env"

section "START APP"
log "Using REPO_ROOT : $REPO_ROOT"
log "Using INFRA_DIR : $INFRA_DIR"
log "APP compose     : $APP_COMPOSE"
log "Env file        : $ENV_FILE"

[[ -f "$APP_COMPOSE" ]] || { red "App compose file not found: $APP_COMPOSE"; exit 1; }
[[ -f "$ENV_FILE" ]] || { red "Env file not found: $ENV_FILE"; exit 1; }

docker network create infra_default >/dev/null 2>&1 || true

COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$APP_COMPOSE")

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

section "1) Stop APP stack"
"${COMPOSE[@]}" down || true

section "2) Start APP stack"
"${COMPOSE[@]}" up -d --build

section "3) Show APP stack status"
"${COMPOSE[@]}" ps || true

section "4) App quick check"
APP_PORT="$(grep -E '^QUARKUS_HTTP_PORT=' "$ENV_FILE" | head -n1 | cut -d= -f2 || true)"
APP_PORT="${APP_PORT:-8080}"

if curl -fsS "http://127.0.0.1:${APP_PORT}/q/health" >/dev/null 2>&1; then
  green "App health check passed on http://127.0.0.1:${APP_PORT}/q/health"
else
  yellow "App health check failed on http://127.0.0.1:${APP_PORT}/q/health"
fi

if [[ "$FOLLOW_LOGS" == "1" ]]; then
  section "5) Follow app logs (Ctrl+C to stop)"
  "${COMPOSE[@]}" logs -f --tail="$TAIL_LINES" &
  PIDS+=($!)
  wait
fi