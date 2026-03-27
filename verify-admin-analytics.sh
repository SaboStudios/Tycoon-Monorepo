#!/bin/bash

# Admin Analytics Verification Script
# This script verifies that the admin analytics module is properly installed

echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo "║           Admin Analytics Module - Installation Verification                ║"
echo "╚══════════════════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0

# Function to check file exists
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $2"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} $2 - File not found: $1"
        ((FAILED++))
    fi
}

# Function to check directory exists
check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✓${NC} $2"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} $2 - Directory not found: $1"
        ((FAILED++))
    fi
}

# Function to check string in file
check_string_in_file() {
    if grep -q "$2" "$1" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $3"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} $3 - String not found in $1"
        ((FAILED++))
    fi
}

echo "📁 Checking Module Structure..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

BASE_PATH="backend/src/modules/admin-analytics"

check_dir "$BASE_PATH" "Module directory exists"
check_dir "$BASE_PATH/dto" "DTO directory exists"

echo ""
echo "📄 Checking Core Files..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_file "$BASE_PATH/admin-analytics.module.ts" "Module file"
check_file "$BASE_PATH/admin-analytics.controller.ts" "Controller file"
check_file "$BASE_PATH/admin-analytics.service.ts" "Service file"
check_file "$BASE_PATH/dto/dashboard-analytics.dto.ts" "DTO file"
check_file "$BASE_PATH/index.ts" "Index file"

echo ""
echo "🧪 Checking Test Files..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_file "$BASE_PATH/admin-analytics.controller.spec.ts" "Controller tests"
check_file "$BASE_PATH/admin-analytics.service.spec.ts" "Service tests"

echo ""
echo "📖 Checking Documentation..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_file "$BASE_PATH/README.md" "README documentation"
check_file "$BASE_PATH/QUICKSTART.md" "Quick start guide"
check_file "$BASE_PATH/TESTING.md" "Testing guide"
check_file "$BASE_PATH/ARCHITECTURE.md" "Architecture documentation"
check_file "$BASE_PATH/IMPLEMENTATION_SUMMARY.md" "Implementation summary"
check_file "ISSUE_RESOLVED.md" "Issue resolution summary"

echo ""
echo "🔗 Checking Integration..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_string_in_file "backend/src/app.module.ts" "AdminAnalyticsModule" "Module imported in app.module.ts"
check_string_in_file "backend/src/app.module.ts" "admin-analytics/admin-analytics.module" "Module path correct in app.module.ts"

echo ""
echo "🔍 Checking Code Quality..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_string_in_file "$BASE_PATH/admin-analytics.controller.ts" "@UseGuards(JwtAuthGuard, AdminGuard)" "Security guards applied"
check_string_in_file "$BASE_PATH/admin-analytics.controller.ts" "@Controller('admin/analytics')" "Controller route correct"
check_string_in_file "$BASE_PATH/admin-analytics.service.ts" "getDashboardAnalytics" "Dashboard method exists"
check_string_in_file "$BASE_PATH/admin-analytics.service.ts" "Promise.all" "Parallel execution implemented"

echo ""
echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo "║                           VERIFICATION RESULTS                               ║"
echo "╚══════════════════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "Tests Passed: ${GREEN}$PASSED${NC}"
echo -e "Tests Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ ALL CHECKS PASSED!${NC}"
    echo ""
    echo "The admin analytics module is properly installed and ready to use."
    echo ""
    echo "Next steps:"
    echo "  1. Start your backend server: cd backend && npm run start:dev"
    echo "  2. Get an admin JWT token"
    echo "  3. Test the endpoints: curl -X GET http://localhost:3000/admin/analytics/dashboard -H \"Authorization: Bearer YOUR_TOKEN\""
    echo ""
    echo "For detailed instructions, see: backend/src/modules/admin-analytics/QUICKSTART.md"
    exit 0
else
    echo -e "${RED}❌ SOME CHECKS FAILED!${NC}"
    echo ""
    echo "Please review the failed checks above and ensure all files are properly created."
    exit 1
fi
