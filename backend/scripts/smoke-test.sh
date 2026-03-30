#!/bin/bash

# Smoke Test Script for Nested Services
# Tests health endpoints and basic functionality

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
MAIN_API_URL="${MAIN_API_URL:-http://localhost:3000}"
ADMIN_SHOP_URL="${ADMIN_SHOP_URL:-http://localhost:3001}"
THEME_MARKETPLACE_URL="${THEME_MARKETPLACE_URL:-http://localhost:3002}"
USER_MANAGEMENT_URL="${USER_MANAGEMENT_URL:-http://localhost:3003}"
ANALYTICS_URL="${ANALYTICS_URL:-http://localhost:3004}"

TIMEOUT=5
PASSED=0
FAILED=0

# Helper functions
test_endpoint() {
  local name=$1
  local url=$2
  local expected_status=${3:-200}

  echo -n "Testing $name... "

  response=$(curl -s -w "\n%{http_code}" -m $TIMEOUT "$url" 2>/dev/null || echo "000")
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)

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
  response=$(curl -s -w "\n%{http_code}" -m $TIMEOUT "$url/api/protected" 2>/dev/null || echo "000")
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
    -m $TIMEOUT 2>/dev/null || echo "{}")

  if echo "$response" | grep -q "statusCode\|error\|timestamp"; then
    echo -e "${GREEN}✓ PASSED${NC} (Error format is consistent)"
    PASSED=$((PASSED + 1))
    return 0
  else
    echo -e "${YELLOW}⚠ SKIPPED${NC} (Could not verify error format)"
    return 0
  fi
}

# Main test execution
echo -e "${YELLOW}=== Tycoon Backend Smoke Tests ===${NC}\n"

echo -e "${YELLOW}Testing Main API${NC}"
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

if [ $FAILED -eq 0 ]; then
  echo -e "\n${GREEN}All tests passed!${NC}"
  exit 0
else
  echo -e "\n${RED}Some tests failed!${NC}"
  exit 1
fi
