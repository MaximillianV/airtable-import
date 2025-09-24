#!/bin/bash

# Script to start the backend server with proper port cleanup and environment checks

echo "Starting Airtable Import Backend Server..."

# Function to kill processes on specified ports
cleanup_ports() {
    local ports=("3001" "3002" "8001")
    
    for port in "${ports[@]}"; do
        echo "Checking port $port..."
        if lsof -ti:$port >/dev/null 2>&1; then
            echo "Killing processes on port $port..."
            lsof -ti:$port | xargs kill -9 || true
            sleep 1
        else
            echo "Port $port is free"
        fi
    done
}

# Function to check Redis availability
check_redis() {
    echo "Checking Redis availability..."
    
    # Check if Redis is running
    if redis-cli ping > /dev/null 2>&1; then
        echo "✅ Redis is running and accessible"
        export REDIS_ENABLED=true
        return 0
    else
        echo "⚠️ Redis is not running or not accessible"
        echo "Attempting to start Redis server..."
        
        # Try to start Redis in the background
        if command -v redis-server > /dev/null 2>&1; then
            redis-server --daemonize yes --port 6379 --bind 127.0.0.1 > /dev/null 2>&1
            sleep 2
            
            # Check again
            if redis-cli ping > /dev/null 2>&1; then
                echo "✅ Redis started successfully"
                export REDIS_ENABLED=true
                return 0
            else
                echo "❌ Failed to start Redis"
                export REDIS_ENABLED=false
                return 1
            fi
        else
            echo "❌ Redis server not found on system"
            echo "Install Redis with: sudo apt-get install redis-server"
            export REDIS_ENABLED=false
            return 1
        fi
    fi
}

# Function to check and set environment variables
check_environment() {
    # Check if .env file exists, create from example if not
    if [ ! -f .env ]; then
        echo "No .env file found, creating one..."
        if [ -f .env.example ]; then
            echo "Creating .env file from .env.example..."
            cp .env.example .env
        else
            echo "Creating basic .env file..."
            # Use SQLite for test environment, PostgreSQL otherwise
            if [ "${NODE_ENV}" = "test" ]; then
                cat > .env << EOF
PORT=3001
NODE_ENV=test
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin123
DATABASE_URL=sqlite::memory:
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=true
EOF
            else
                cat > .env << EOF
PORT=3001
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin123
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/airtable_import
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=true
EOF
            fi
        fi
    else
        echo "Using existing .env file..."
    fi
    
    # Source the .env file
    if [ -f .env ]; then
        export $(cat .env | grep -v '^#' | xargs)
    fi
    
    # Check if JWT_SECRET is set
    if [ -z "$JWT_SECRET" ]; then
        echo "Warning: JWT_SECRET not set, using default..."
        export JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
    fi
    
    # Check if PORT is set
    if [ -z "$PORT" ]; then
        echo "Warning: PORT not set, using default 3001..."
        export PORT=3001
    fi
    
    echo "Environment configured:"
    echo "  PORT: $PORT"
    echo "  JWT_SECRET: ${JWT_SECRET:0:20}..." # Only show first 20 chars for security
    echo "  NODE_ENV: ${NODE_ENV:-development}"
}

# Main execution
echo "=== Airtable Import Backend Startup ==="

# Clean up ports
cleanup_ports

# Check Redis
check_redis

# Check environment
check_environment

# Display Redis status
if [ "$REDIS_ENABLED" = "true" ]; then
    echo "✅ Redis integration: ENABLED"
    echo "  Redis URL: ${REDIS_URL:-redis://localhost:6379}"
else
    echo "⚠️ Redis integration: DISABLED (fallback to in-memory storage)"
fi

# Start the server
echo "Starting server on port $PORT..."
if [ "$1" = "dev" ]; then
    npm run dev
else
    npm start
fi