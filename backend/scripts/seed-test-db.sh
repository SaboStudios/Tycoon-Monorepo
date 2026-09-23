#!/bin/bash
# Seed script for integration test Postgres DB
#
# Fail-closed seeding for CI/local parity (issue #1719).
# Required env (no silent defaults):
#   POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
# Optional:
#   SEED_SQL_FILE  path to a .sql file to apply instead of the inline seed
#   PG_CONNECT_TIMEOUT  seconds to wait for Postgres (default 5)
set -euo pipefail

fail() {
  echo "[seed-test-db] ERROR: $*" >&2
  exit 1
}

# --- Fail-closed env validation -------------------------------------------
: "${POSTGRES_HOST:?POSTGRES_HOST is required (no default)}"
: "${POSTGRES_PORT:?POSTGRES_PORT is required (no default)}"
: "${POSTGRES_USER:?POSTGRES_USER is required (no default)}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required (no default)}"
: "${POSTGRES_DB:?POSTGRES_DB is required (no default)}"

PG_CONNECT_TIMEOUT="${PG_CONNECT_TIMEOUT:-5}"

command -v psql >/dev/null 2>&1 || fail "psql not found on PATH; install the Postgres client"

# --- Dependency check: Postgres reachable? --------------------------------
if ! PGPASSWORD="$POSTGRES_PASSWORD" psql \
  -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -v ON_ERROR_STOP=1 -c 'SELECT 1;' >/dev/null 2>&1; then
  fail "cannot connect to Postgres at ${POSTGRES_HOST}:${POSTGRES_PORT} (db=${POSTGRES_DB}); is the dependency up?"
fi

# --- Idempotent seed ------------------------------------------------------
# Seeding is safe to re-run: the inline seed is a no-op placeholder and any
# SEED_SQL_FILE is expected to be idempotent (e.g. ON CONFLICT DO NOTHING).
if [ -n "${SEED_SQL_FILE:-}" ]; then
  [ -f "$SEED_SQL_FILE" ] || fail "SEED_SQL_FILE not found: $SEED_SQL_FILE"
  echo "[seed-test-db] applying $SEED_SQL_FILE to ${POSTGRES_DB}"
  PGPASSWORD="$POSTGRES_PASSWORD" psql \
    -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    -v ON_ERROR_STOP=1 -f "$SEED_SQL_FILE"
else
  echo "[seed-test-db] applying inline seed to ${POSTGRES_DB}"
  PGPASSWORD="$POSTGRES_PASSWORD" psql \
    -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    -v ON_ERROR_STOP=1 <<'EOF'
-- Add your seed SQL here
-- Example:
-- INSERT INTO users (id, name) VALUES (1, 'Test User') ON CONFLICT DO NOTHING;
EOF
fi

echo "[seed-test-db] done"
