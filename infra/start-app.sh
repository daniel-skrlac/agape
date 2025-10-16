#!/usr/bin/env bash
set -euo pipefail

# ───────────── config ─────────────
: "${TAIL_LINES:=200}"

# ───────────── pretty helpers ─────────────
bold()  { printf "\033[1m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
red()   { printf "\033[31m%s\033[0m\n" "$*"; }
log()   { printf "[%s] %s\n" "$(date +"%Y-%m-%d %H:%M:%S")" "$*"; }
section(){ echo; bold "──────── $* ────────"; }

# ───────────── repo detection ─────────────
resolve_root() {
  if [[ "${1-}" != "" ]]; then (cd "$1" && pwd) && return; fi
  if command -v git >/dev/null 2>&1 && git rev-parse --show-toplevel >/dev/null 2>&1; then
    git rev-parse --show-toplevel; return
  fi
  local dir="$PWD"
  while [[ "$dir" != "/" ]]; do
    if [[ -f "$dir/infra/docker-compose.app.yml" ]]; then
      echo "$dir"; return
    fi
    dir="$(dirname "$dir")"
  done
  echo "ERROR: Could not locate repo root (looking for infra/docker-compose.app.yml)." >&2
  exit 1
}

REPO_ROOT="$(resolve_root "${1-}")"
cd "$REPO_ROOT"
APP_COMPOSE="$REPO_ROOT/infra/docker-compose.app.yml"

section "START APP"
log "Using REPO_ROOT: $REPO_ROOT"
log "APP compose    : $APP_COMPOSE"

if [[ ! -f "$APP_COMPOSE" ]]; then
  red "App compose file not found"; exit 1
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

# ───────────── start app ─────────────
section "1) Stop APP stack and remove orphans/volumes"
docker compose -f "$APP_COMPOSE" down --volumes || true

section "2) Start APP stack"
docker compose -f "$APP_COMPOSE" up -d --build

section "3) Show APP stack status"
docker compose -f "$APP_COMPOSE" ps || true

section "4) Follow app logs (Ctrl+C to stop)"
docker compose -f "$APP_COMPOSE" logs -f --tail="$TAIL_LINES" &
PIDS+=($!)

wait
