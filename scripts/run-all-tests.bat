@echo off
REM Run all tests with proper setup

echo Running all tests...
echo.

REM Set test environment variables
set DB_HOST=localhost
set DB_PORT=5432
set DB_USERNAME=postgres
set DB_PASSWORD=postgres
set DB_NAME=test_db
set JWT_SECRET=test-secret-key

echo Installing dependencies...
call npm install

echo.
echo Running unit tests...
call npm test

if %errorlevel% neq 0 (
    echo Unit tests failed!
    exit /b 1
)

echo Unit tests passed!

echo.
echo Running E2E tests...
call npm run test:e2e

if %errorlevel% neq 0 (
    echo E2E tests failed!
    exit /b 1
)

echo E2E tests passed!

echo.
echo Generating coverage report...
call npm run test:cov

echo.
echo All tests completed successfully!
