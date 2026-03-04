@echo off
REM Setup test database for local development

echo Setting up test database...

REM Check if Docker is available
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Docker not found. Please install Docker Desktop for Windows.
    echo Or set up PostgreSQL manually with database: test_db
    exit /b 1
)

echo Docker found. Starting PostgreSQL container...

REM Stop and remove existing container if it exists
docker stop postgres-test >nul 2>&1
docker rm postgres-test >nul 2>&1

REM Start new PostgreSQL container
docker run --name postgres-test ^
    -e POSTGRES_USER=postgres ^
    -e POSTGRES_PASSWORD=postgres ^
    -e POSTGRES_DB=test_db ^
    -p 5432:5432 ^
    -d postgres:15

echo Waiting for PostgreSQL to be ready...
timeout /t 5 /nobreak >nul

echo PostgreSQL is ready!
echo Connection details:
echo   Host: localhost
echo   Port: 5432
echo   Database: test_db
echo   Username: postgres
echo   Password: postgres
