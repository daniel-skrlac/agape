#!/usr/bin/env bash
set -euo pipefail

resolve_root() {
  if [[ "${1-}" != "" ]]; then
    echo "$(cd "$1" && pwd)"
    return
  fi

  if command -v git >/dev/null 2>&1; then
    if git rev-parse --show-toplevel >/dev/null 2>&1; then
      git rev-parse --show-toplevel
      return
    fi
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
DB_COMPOSE="$REPO_ROOT/infra/docker-compose.db.yml"
APP_COMPOSE="$REPO_ROOT/infra/docker-compose.app.yml"

echo "Using REPO_ROOT: $REPO_ROOT"
echo "DB compose     : $DB_COMPOSE"
echo "APP compose    : $APP_COMPOSE"

if [[ ! -f "$DB_COMPOSE" || ! -f "$APP_COMPOSE" ]]; then
  echo "ERROR: Compose files not found. Check your repo structure." >&2
  exit 1
fi

wait_for_oracle() {
  local cname="infra-oracle-xe-1"
  echo "Waiting for Oracle container ($cname) to be healthy..."
  for i in {1..60}; do
    local status
    status="$(docker inspect -f '{{json .State.Health.Status}}' "$cname" 2>/dev/null || echo '"starting"')"
    if [[ "$status" == "\"healthy\"" ]]; then
      echo "Oracle is healthy."
      return 0
    fi
    sleep 3
  done
  echo "ERROR: Oracle did not become healthy in time." >&2
  exit 1
}

echo "1) Stop ALL stacks (app + db) and remove orphans/anonymous volumes"
docker compose -f "$APP_COMPOSE" down --volumes --remove-orphans || true
docker compose -f "$DB_COMPOSE"  down --volumes --remove-orphans || true

echo "3) Start DB stack fresh"
docker compose -f "$DB_COMPOSE" up -d --build

wait_for_oracle

echo "4) Drop & recreate Oracle schema user (IN_WPRG)"
docker exec -i infra-oracle-xe-1 bash -lc '
set -e
sqlplus -s sys/$ORACLE_PASSWORD@XEPDB1 AS SYSDBA <<SQL
ALTER SESSION SET "_ORACLE_SCRIPT"=true;
BEGIN
  EXECUTE IMMEDIATE q'[DROP USER IN_WPRG CASCADE]';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -01918 AND SQLCODE != -01940 THEN -- user does not exist / dropped with active sessions
    RAISE;
  END IF;
END;
/
CREATE USER IN_WPRG IDENTIFIED BY in_wprg DEFAULT TABLESPACE USERS TEMPORARY TABLESPACE TEMP;
GRANT CONNECT, RESOURCE TO IN_WPRG;
ALTER USER IN_WPRG QUOTA UNLIMITED ON USERS;
EXIT
SQL
'

docker compose -f "$DB_COMPOSE" up -d --build oracle-ensure-user || true

docker compose -f "$APP_COMPOSE" up -d --build

docker compose -f "$APP_COMPOSE" logs -f api
