#!/usr/bin/env bash
# scripts/smoke-monorepo.sh
#
# Monorepo smoke test — verifies that the backend and shop-api health
# endpoints are reachable after `dev:all` (or docker-compose) has started.
#
# Usage:
#   bash scripts/smoke-monorepo.sh
#
# Prerequisites (docker-compose):
#   docker compose up -d         # starts postgres + redis
#   npm run dev:all              # starts backend (:3001) and shop-api (:3002) and frontend (:3000)
#
# Environment overrides:
#   BACKEND_URL    — defaults to http://localhost:3001
#   SHOP_API_URL   — defaults to http://localhost:3002
#   TIMEOUT        — per-request curl timeout in seconds (default: 10)
#   RETRIES        — number of retry attempts per endpoint (default: 3)
#   RETRY_DELAY    — seconds between retries (default: 3)
#
# Exit codes:
#   0  — all health checks passed
#   1  — one or more health checks failed

set -euo pipefail

# ── Colour helpers ──────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# ── Configuration ────────────────────────────────────────────────────────────
BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"
SHOP_API_URL="${SHOP_API_URL:-http://localhost:3002}"
TIMEOUT="${TIMEOUT:-10}"
RETRIES="${RETRIES:-3}"
RETRY_DELAY="${RETRY_DELAY:-3}"

PASSED=0
FAILED=0

# ── Helper: probe a single health endpoint with retries ─────────────────────
check_health() {
  local name="$1"
  local url="$2"
  local attempt=1

  echo -e "${CYAN}▶ Checking $name${NC} — ${url}"

  while [ "$attempt" -le "$RETRIES" ]; do
    http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$url" 2>/dev/null || echo "000")

    if [ "$http_code" = "200" ]; then
      echo -e "  ${GREEN}✓ PASSED${NC} (HTTP 200, attempt $attempt)"
      PASSED=$((PASSED + 1))
      return 0
    fi

    echo -e "  ${YELLOW}⚠ attempt $attempt/$RETRIES: got HTTP $http_code${NC}"
    if [ "$attempt" -lt "$RETRIES" ]; then
      sleep "$RETRY_DELAY"
    fi
    attempt=$((attempt + 1))
  done

  echo -e "  ${RED}✗ FAILED${NC} — $name did not return 200 after $RETRIES attempts"
  FAILED=$((FAILED + 1))
  return 1
}

# ── Main ─────────────────────────────────────────────────────────────────────
echo -e "${YELLOW}=== TYNS Monorepo Smoke Test ===${NC}"
echo "Backend URL : $BACKEND_URL"
echo "Shop-API URL: $SHOP_API_URL"
echo ""

check_health "Backend health"  "${BACKEND_URL}/health"   || true
check_health "Shop-API health" "${SHOP_API_URL}/health"  || true

echo ""
echo -e "${YELLOW}=== Summary ===${NC}"
echo -e "  Passed : ${GREEN}$PASSED${NC}"
echo -e "  Failed : ${RED}$FAILED${NC}"

if [ "$FAILED" -gt 0 ]; then
  echo -e "\n${RED}Smoke test FAILED — one or more services are unreachable.${NC}"
  echo "Ensure services are running: npm run dev:all"
  echo "Or start compose first: docker compose up -d && npm run dev:all"
  exit 1
fi

echo -e "\n${GREEN}All smoke checks passed.${NC}"
exit 0
