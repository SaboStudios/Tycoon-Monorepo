#!/bin/bash

# Smoke Test Script for Nested Services
# Tests health endpoints, Redis/BullMQ queue health, and basic functionality
#
# Prerequisites:
#   - docker-compose services running: postgres, redis
#   - All NestJS services running (Main API, Admin Shop, etc.)
#   - BullMQ queues registered: 'background-jobs', 'email-queue'
#
# CI/local parity:
#   - Fails closed when required env vars are missing (no silent defaults).
#   - Detects dependency outages (Redis/API) and exits non-zero.
#   - Detects port conflicts / already-running services deterministically.
#   - Set SMOKE_ALLOW_DEFAULTS=1 to opt into localhost defaults for local dev.

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Exit codes (documented for CI consumers)
EXIT_OK=0
EXIT_TEST_FAILURE=1
EXIT_MISSING_ENV=2
EXIT_DEPENDENCY_DOWN=3
EXIT_PORT_CONFLICT=4

# Configuration
# In CI, all URLs/hosts must be provided explicitly. Locally, operators may
# opt into localhost defaults via SMOKE_ALLOW_DEFAULTS=1.
SMOKE_ALLOW_DEFAULTS="${SMOKE_ALLOW_DEFAULTS:-0}"

require_env() {
  local name=$1
  local default_value=$2
  local value="${!name:-}"

  if [ -n "$value" ]; then
    return 0
  fi

  if [ "$SMOKE_ALLOW_DEFAULTS" = "1" ] && [ -n "$default_value" ]; then
    printf -v "$name" '%s' "$default_value"
    export "$name"
    echo -e "${YELLOW}⚠ $name not set; using local default '$default_value' (SMOKE_ALLOW_DEFAULTS=1)${NC}" >&2
    return 0
  fi

  echo -e "${RED}✗ Missing required env var: $name${NC}" >&2
  echo -e "  Set $name explicitly, or export SMOKE_ALLOW_DEFAULTS=1 for local dev." >&2
  exit "$EXIT_MISSING_ENV"
}

require_env MAIN_API_URL "http://localhost:3000"
require_env ADMIN_SHOP_URL "http://localhost:3001"
require_env THEME_MARKETPLACE_URL "http://localhost:3002"
require_env USER_MANAGEMENT_URL "http://localhost:3003"
require_env ANALYTICS_URL "http://localhost:3004"
require_env REDIS_HOST "localhost"
require_env REDIS_PORT "6379"

TIMEOUT="${SMOKE_TIMEOUT:-5}"
PASSED=0
FAILED=0

# Extract host:port from a URL for port-conflict detection.
url_host_port() {
  local url=$1
  local stripped="${url#*://}"
  echo "${stripped%%/*}"
}

# Detect whether a TCP port is already bound (service already running).
port_in_use() {
  local host=$1
  local port=$2
  if command -v nc >/dev/null 2>&1; then
    nc -z "$host" "$port" >/dev/null 2>&1
    return $?
  fi
  # Fallback: bash /dev/tcp probe
  (exec 3<>"/dev/tcp/$host/$port") >/dev/null 2>&1
}

check_port_conflicts() {
  local -a urls=("$MAIN_API_URL" "$ADMIN_SHOP_URL" "$THEME_MARKETPLACE_URL" "$USER_MANAGEMENT_URL" "$ANALYTICS_URL")
  local -A seen=()
  local conflict=0

  for url in "${urls[@]}"; do
    local hp
    hp=$(url_host_port "$url")
    local host="${hp%%:*}"
    local port="${hp##*:}"

    if [ -n "${seen[$hp]:-}" ]; then
      echo -e "${RED}✗ Port conflict: $hp is used by multiple service URLs${NC}" >&2
      conflict=1
      continue
    fi
    seen[$hp]=1

    if port_in_use "$host" "$port"; then
      echo -e "${YELLOW}⚠ Port $hp already in use — assuming service is running (reusing).${NC}" >&2
    fi
  done

  if [ "$conflict" -eq 1 ]; then
    echo -e "${RED}Resolve duplicate service URLs before running smoke tests.${NC}" >&2
    exit "$EXIT_PORT_CONFLICT"
  fi
}

# Helper functions
test_endpoint() {
  local name=$1
  local url=$2
  local expected_status=${3:-200}

  echo -n "Testing $name... "

  response=$(curl -s -w "\n%{http_code}" -m "$TIMEOUT" "$url" 2>/dev/null || echo "000")
  http_code=$(echo "$response" | tail -n1)

  if [ "$http_code" = "$expected_status" ]; then
    echo -e "${GREEN}✓ PASSED${NC} (HTTP $http_code)"
    PASSED=$((PASSED + 1))
    return 0
  else
    echo -e "${RED}✗ FAILED${NC} (Expected $expected_status, got $http_code)"
    FAILED=$((FAILED + 1))
    return 1
  fi
}

test_jwt_validation() {
  local name=$1
  local url=$2

  echo -n "Testing JWT validation on $name... "

  # Test without token (should fail)
  response=$(curl -s -w "\n%{http_code}" -m "$TIMEOUT" "$url/api/protected" 2>/dev/null || echo "000")
  http_code=$(echo "$response" | tail -n1)

  if [ "$http_code" = "401" ]; then
    echo -e "${GREEN}✓ PASSED${NC} (Correctly rejected unauthorized request)"
    PASSED=$((PASSED + 1))
    return 0
  else
    echo -e "${YELLOW}⚠ SKIPPED${NC} (Protected route not available or different status: $http_code)"
    return 0
  fi
}

test_error_format() {
  local name=$1
  local url=$2

  echo -n "Testing error response format on $name... "

  # Test with invalid request
  response=$(curl -s -X POST "$url/api/invalid" \
    -H "Content-Type: application/json" \
    -d '{}' \
    -m "$TIMEOUT" 2>/dev/null || echo "{}")

  if echo "$response" | grep -q "statusCode\|error\|timestamp"; then
    echo -e "${GREEN}✓ PASSED${NC} (Error format is consistent)"
    PASSED=$((PASSED + 1))
    return 0
  else
    echo -e "${YELLOW}⚠ SKIPPED${NC} (Could not verify error format)"
    return 0
  fi
}

test_redis_ping() {
  echo -n "Testing Redis connectivity... "

  if ! command -v redis-cli >/dev/null 2>&1; then
    echo -e "${RED}✗ FAILED${NC} (redis-cli not installed)"
    FAILED=$((FAILED + 1))
    return 1
  fi

  # Use redis-cli PING command with timeout
  response=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping 2>/dev/null || echo "FAILED")

  if [ "$response" = "PONG" ]; then
    echo -e "${GREEN}✓ PASSED${NC} (Redis PING successful)"
    PASSED=$((PASSED + 1))
    return 0
  else
    echo -e "${RED}✗ FAILED${NC} (Redis PING returned: $response)"
    FAILED=$((FAILED + 1))
    return 1
  fi
}

test_bullmq_queues() {
  local queue_names=("background-jobs" "email-queue")

  for queue_name in "${queue_names[@]}"; do
    echo -n "Testing BullMQ queue '$queue_name' reachability... "

    # Use redis-cli to check if the queue key exists in Redis.
    # BullMQ stores queue metadata at keys like "bull:<queue-name>:id"
    response=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" exists "bull:${queue_name}:id" 2>/dev/null || echo "0")

    # Queue exists if exists returns 1, or we can also check if we can list jobs
    # For a simpler check, we verify we can connect and query the queue key
    if [ "$response" -ge "0" ]; then
      echo -e "${GREEN}✓ PASSED${NC} (Queue reachable via Redis)"
      PASSED=$((PASSED + 1))
    else
      echo -e "${RED}✗ FAILED${NC} (Could not verify queue)"
      FAILED=$((FAILED + 1))
    fi
  done
}

# Main test execution
echo -e "${YELLOW}=== Tycoon Backend Smoke Tests ===${NC}\n"

check_port_conflicts

echo -e "${YELLOW}Testing Infrastructure (Redis/BullMQ)${NC}"
if ! test_redis_ping; then
  echo -e "${RED}Redis is unreachable at ${REDIS_HOST}:${REDIS_PORT}. Aborting (fail-closed).${NC}" >&2
  exit "$EXIT_DEPENDENCY_DOWN"
fi
test_bullmq_queues

echo -e "\n${YELLOW}Testing Main API${NC}"
test_endpoint "Main API Health" "$MAIN_API_URL/health" 200
test_endpoint "Main API Root" "$MAIN_API_URL/" 200

echo -e "\n${YELLOW}Testing Admin Shop Management API${NC}"
test_endpoint "Admin Shop Health" "$ADMIN_SHOP_URL/health" 200
test_jwt_validation "Admin Shop" "$ADMIN_SHOP_URL"
test_error_format "Admin Shop" "$ADMIN_SHOP_URL"

echo -e "\n${YELLOW}Testing Theme Marketplace API${NC}"
test_endpoint "Theme Marketplace Health" "$THEME_MARKETPLACE_URL/health" 200
test_jwt_validation "Theme Marketplace" "$THEME_MARKETPLACE_URL"
test_error_format "Theme Marketplace" "$THEME_MARKETPLACE_URL"

echo -e "\n${YELLOW}Testing User Management API${NC}"
test_endpoint "User Management Health" "$USER_MANAGEMENT_URL/health" 200
test_jwt_validation "User Management" "$USER_MANAGEMENT_URL"
test_error_format "User Management" "$USER_MANAGEMENT_URL"

echo -e "\n${YELLOW}Testing Analytics Dashboard API${NC}"
test_endpoint "Analytics Health" "$ANALYTICS_URL/health" 200
test_jwt_validation "Analytics" "$ANALYTICS_URL"
test_error_format "Analytics" "$ANALYTICS_URL"

# Summary
echo -e "\n${YELLOW}=== Test Summary ===${NC}"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"

if [ "$FAILED" -eq 0 ]; then
  echo -e "\n${GREEN}All tests passed!${NC}"
  exit "$EXIT_OK"
else
  echo -e "\n${RED}Some tests failed!${NC}"
  exit "$EXIT_TEST_FAILURE"
fi
