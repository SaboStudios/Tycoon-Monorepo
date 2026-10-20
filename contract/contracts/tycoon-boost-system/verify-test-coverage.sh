#!/bin/bash
# Verification script for tycoon-boost-system test coverage improvements
# SW-CONTRACT-BOOST-001

set -e

echo "========================================="
echo "Tycoon Boost System - Test Coverage Verification"
echo "SW-CONTRACT-BOOST-001"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0

# Helper functions
pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "Cargo.toml" ]; then
    fail "Not in tycoon-boost-system directory"
    exit 1
fi

echo "1. Checking file structure..."
echo "----------------------------"

# Check for new test files
if [ -f "src/advanced_integration_tests.rs" ]; then
    pass "advanced_integration_tests.rs exists"
else
    fail "advanced_integration_tests.rs missing"
fi

if [ -f "../../integration-tests/src/boost_system_integration.rs" ]; then
    pass "boost_system_integration.rs exists"
else
    fail "boost_system_integration.rs missing"
fi

# Check for documentation
if [ -f "TEST_COVERAGE_IMPROVEMENTS.md" ]; then
    pass "TEST_COVERAGE_IMPROVEMENTS.md exists"
else
    fail "TEST_COVERAGE_IMPROVEMENTS.md missing"
fi

if [ -f "PR_DESCRIPTION.md" ]; then
    pass "PR_DESCRIPTION.md exists"
else
    fail "PR_DESCRIPTION.md missing"
fi

if [ -f "IMPLEMENTATION_SUMMARY_SW-CONTRACT-BOOST-001.md" ]; then
    pass "IMPLEMENTATION_SUMMARY_SW-CONTRACT-BOOST-001.md exists"
else
    fail "IMPLEMENTATION_SUMMARY_SW-CONTRACT-BOOST-001.md missing"
fi

echo ""
echo "2. Checking code references..."
echo "----------------------------"

# Check if lib.rs includes new test module
if grep -q "mod advanced_integration_tests" src/lib.rs; then
    pass "lib.rs includes advanced_integration_tests module"
else
    fail "lib.rs missing advanced_integration_tests module reference"
fi

# Check if integration tests lib.rs includes boost module
if grep -q "mod boost_system_integration" ../../integration-tests/src/lib.rs; then
    pass "integration-tests/lib.rs includes boost_system_integration"
else
    fail "integration-tests/lib.rs missing boost_system_integration reference"
fi

# Check if fixture includes boost system
if grep -q "TycoonBoostSystem" ../../integration-tests/src/fixture.rs; then
    pass "fixture.rs includes TycoonBoostSystem"
else
    fail "fixture.rs missing TycoonBoostSystem"
fi

# Check if Cargo.toml includes boost system
if grep -q "tycoon-boost-system" ../../integration-tests/Cargo.toml; then
    pass "integration-tests/Cargo.toml includes tycoon-boost-system"
else
    fail "integration-tests/Cargo.toml missing tycoon-boost-system dependency"
fi

echo ""
echo "3. Checking documentation updates..."
echo "----------------------------"

# Check if README mentions new test count
if grep -q "121" README.md; then
    pass "README.md updated with new test count"
else
    warn "README.md may need test count update"
fi

# Check if CHANGELOG has new entry
if grep -q "0.1.1" CHANGELOG.md; then
    pass "CHANGELOG.md has version 0.1.1 entry"
else
    fail "CHANGELOG.md missing version 0.1.1 entry"
fi

if grep -q "SW-CONTRACT-BOOST-001" CHANGELOG.md; then
    pass "CHANGELOG.md references SW-CONTRACT-BOOST-001"
else
    fail "CHANGELOG.md missing SW-CONTRACT-BOOST-001 reference"
fi

echo ""
echo "4. Running cargo check..."
echo "----------------------------"

if cargo check --quiet 2>/dev/null; then
    pass "cargo check passes"
else
    fail "cargo check failed"
fi

echo ""
echo "5. Running cargo fmt check..."
echo "----------------------------"

if cargo fmt -- --check 2>/dev/null; then
    pass "cargo fmt check passes"
else
    warn "cargo fmt check failed (run 'cargo fmt' to fix)"
fi

echo ""
echo "6. Running cargo clippy..."
echo "----------------------------"

if cargo clippy --quiet -- -D warnings 2>/dev/null; then
    pass "cargo clippy passes"
else
    warn "cargo clippy has warnings"
fi

echo ""
echo "7. Counting tests..."
echo "----------------------------"

# Count tests in each file
TEST_RS=$(grep -c "^fn test_" src/test.rs 2>/dev/null || echo "0")
CAP_RS=$(grep -c "^fn test_" src/cap_stacking_expiry_tests.rs 2>/dev/null || echo "0")
TIME_RS=$(grep -c "^fn test_" src/time_boundary_tests.rs 2>/dev/null || echo "0")
ADV_RS=$(grep -c "^fn test_" src/advanced_integration_tests.rs 2>/dev/null || echo "0")

UNIT_TOTAL=$((TEST_RS + CAP_RS + TIME_RS + ADV_RS))

echo "Unit tests:"
echo "  - test.rs: $TEST_RS tests"
echo "  - cap_stacking_expiry_tests.rs: $CAP_RS tests"
echo "  - time_boundary_tests.rs: $TIME_RS tests"
echo "  - advanced_integration_tests.rs: $ADV_RS tests"
echo "  Total unit tests: $UNIT_TOTAL"

if [ -f "../../integration-tests/src/boost_system_integration.rs" ]; then
    INT_RS=$(grep -c "^fn test_" ../../integration-tests/src/boost_system_integration.rs 2>/dev/null || echo "0")
    echo "  Integration tests: $INT_RS tests"
    TOTAL_TESTS=$((UNIT_TOTAL + INT_RS))
else
    TOTAL_TESTS=$UNIT_TOTAL
fi

echo "  TOTAL: $TOTAL_TESTS tests"

if [ $TOTAL_TESTS -ge 121 ]; then
    pass "Test count meets target (≥121)"
else
    warn "Test count below target: $TOTAL_TESTS < 121"
fi

echo ""
echo "8. Running unit tests..."
echo "----------------------------"

if cargo test --quiet 2>/dev/null; then
    pass "Unit tests pass"
else
    fail "Unit tests failed"
fi

echo ""
echo "========================================="
echo "Verification Summary"
echo "========================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Failed: $FAILED${NC}"
fi
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Review the test coverage documentation"
    echo "2. Run integration tests: cargo test --package tycoon-integration-tests boost_system"
    echo "3. Create PR with reference to SW-CONTRACT-BOOST-001"
    echo "4. Ensure CI is green"
    exit 0
else
    echo -e "${RED}✗ Some checks failed. Please fix the issues above.${NC}"
    exit 1
fi

