#!/bin/bash

# Setup test database for local development

echo "Setting up test database..."

# Check if Docker is available
if command -v docker &> /dev/null; then
    echo "Docker found. Starting PostgreSQL container..."
    
    # Stop and remove existing container if it exists
    docker stop postgres-test 2>/dev/null
    docker rm postgres-test 2>/dev/null
    
    # Start new PostgreSQL container
    docker run --name postgres-test \
        -e POSTGRES_USER=postgres \
        -e POSTGRES_PASSWORD=postgres \
        -e POSTGRES_DB=test_db \
        -p 5432:5432 \
        -d postgres:15
    
    echo "Waiting for PostgreSQL to be ready..."
    sleep 5
    
    echo "✅ PostgreSQL is ready!"
    echo "Connection details:"
    echo "  Host: localhost"
    echo "  Port: 5432"
    echo "  Database: test_db"
    echo "  Username: postgres"
    echo "  Password: postgres"
else
    echo "Docker not found. Please install Docker or set up PostgreSQL manually."
    echo "Required database: test_db"
    exit 1
fi
