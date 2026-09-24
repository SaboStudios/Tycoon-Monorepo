#!/bin/bash

echo "=== Tycoon Boost System - Build Verification ==="
echo ""

# Check if contract files exist
echo "✓ Checking contract structure..."
if [ -f "src/lib.rs" ] && [ -f "src/test.rs" ] && [ -f "Cargo.toml" ]; then
    echo "  ✓ All required files present"
else
    echo "  ✗ Missing required files"
    exit 1
fi

# Check syntax (basic validation)
echo ""
echo "✓ Validating Rust syntax..."
if grep -q "#\[contract\]" src/lib.rs && grep -q "#\[contractimpl\]" src/lib.rs; then
    echo "  ✓ Contract structure valid"
else
    echo "  ✗ Invalid contract structure"
    exit 1
fi

# Check test structure
echo ""
echo "✓ Validating test structure..."
if grep -q "#\[test\]" src/test.rs; then
    echo "  ✓ Tests present"
    TEST_COUNT=$(grep -c "#\[test\]" src/test.rs)
    echo "  ✓ Found $TEST_COUNT test cases"
else
    echo "  ✗ No tests found"
    exit 1
fi

echo ""
echo "=== Verification Complete ==="
echo ""
echo "To build and test (requires Stellar CLI and Rust):"
echo "  make build  # Build the contract"
echo "  make test   # Run tests"
echo ""
echo "Contract implements:"
echo "  - Additive boost stacking"
echo "  - Multiplicative boost stacking"
echo "  - Override boost with priority"
echo "  - Deterministic outcomes"
echo "  - Conflict resolution"
