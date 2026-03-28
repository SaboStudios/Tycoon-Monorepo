#!/bin/bash
# Seed script for integration test Postgres DB
set -e

export PGPASSWORD=${POSTGRES_PASSWORD:-postgres}
psql -h ${POSTGRES_HOST:-localhost} -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-tycoon_test_ci} <<EOF
-- Add your seed SQL here
-- Example:
-- INSERT INTO users (id, name) VALUES (1, 'Test User');
EOF
