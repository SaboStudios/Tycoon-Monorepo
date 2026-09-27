#!/bin/bash

# Run all tests with proper setup

echo "🧪 Running all tests..."
echo ""

# Set test environment variables
export DB_HOST=localhost
export DB_PORT=5432
export DB_USERNAME=postgres
export DB_PASSWORD=postgres
export DB_NAME=test_db
export JWT_SECRET=test-secret-key

echo "📦 Installing dependencies..."
npm install

echo ""
echo "🔬 Running unit tests..."
npm test

if [ $? -eq 0 ]; then
    echo "✅ Unit tests passed!"
else
    echo "❌ Unit tests failed!"
    exit 1
fi

echo ""
echo "🌐 Running E2E tests..."
npm run test:e2e

if [ $? -eq 0 ]; then
    echo "✅ E2E tests passed!"
else
    echo "❌ E2E tests failed!"
    exit 1
fi

echo ""
echo "📊 Generating coverage report..."
npm run test:cov

echo ""
echo "✅ All tests completed successfully!"
