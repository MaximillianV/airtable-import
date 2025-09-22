#!/bin/bash

# Script to start the frontend React app with proper environment setup

echo "Starting Airtable Import Frontend..."

# Function to kill processes on frontend port (3000)
cleanup_frontend_port() {
    local port="3000"
    
    echo "Checking port $port..."
    if lsof -ti:$port >/dev/null 2>&1; then
        echo "Killing processes on port $port..."
        lsof -ti:$port | xargs kill -9 || true
        sleep 1
    else
        echo "Port $port is free"
    fi
}

# Function to check and set environment variables
check_environment() {
    # Check if .env.local file exists, create it if not
    if [ ! -f .env.local ]; then
        echo "Creating .env.local file..."
        cat > .env.local << EOF
REACT_APP_API_URL=http://localhost:3001/api
REACT_APP_SOCKET_URL=http://localhost:3001
EOF
    fi
    
    echo "Frontend environment configured:"
    echo "  REACT_APP_API_URL: $(grep REACT_APP_API_URL .env.local | cut -d= -f2)"
    echo "  REACT_APP_SOCKET_URL: $(grep REACT_APP_SOCKET_URL .env.local | cut -d= -f2)"
}

# Main execution
echo "=== Airtable Import Frontend Startup ==="

# Clean up frontend port
cleanup_frontend_port

# Check environment
check_environment

# Start the frontend
echo "Starting React development server..."
npm start