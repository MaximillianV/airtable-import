#!/bin/bash

# Script to start both frontend and backend services with proper port cleanup

echo "=== Airtable Import Full Stack Startup ==="

# Function to kill processes on all common ports
cleanup_all_ports() {
    local ports=("3000" "3001" "3002" "8001" "8080")
    
    echo "Cleaning up all development ports..."
    for port in "${ports[@]}"; do
        if lsof -ti:$port >/dev/null 2>&1; then
            echo "Killing processes on port $port..."
            lsof -ti:$port | xargs kill -9 || true
        fi
    done
    
    # Wait for cleanup to complete
    sleep 2
    echo "Port cleanup completed"
}

# Function to start backend
start_backend() {
    echo "Starting backend server..."
    cd backend
    
    # Use the safe startup script
    ./start-server.sh dev &
    BACKEND_PID=$!
    cd ..
    
    # Wait for backend to be ready
    echo "Waiting for backend to be ready..."
    timeout 30s bash -c 'until curl -f http://localhost:3001/api/health >/dev/null 2>&1; do sleep 1; done' || {
        echo "ERROR: Backend failed to start within 30 seconds"
        kill $BACKEND_PID 2>/dev/null || true
        exit 1
    }
    
    echo "✅ Backend is running on http://localhost:3001"
    return $BACKEND_PID
}

# Function to start frontend
start_frontend() {
    echo "Starting frontend React app..."
    cd frontend
    
    # Use the safe startup script
    ./start-frontend.sh &
    FRONTEND_PID=$!
    cd ..
    
    # Wait for frontend to be ready
    echo "Waiting for frontend to be ready..."
    timeout 60s bash -c 'until curl -f http://localhost:3000 >/dev/null 2>&1; do sleep 1; done' || {
        echo "ERROR: Frontend failed to start within 60 seconds"
        kill $FRONTEND_PID 2>/dev/null || true
        exit 1
    }
    
    echo "✅ Frontend is running on http://localhost:3000"
    return $FRONTEND_PID
}

# Function to handle cleanup on exit
cleanup_on_exit() {
    echo ""
    echo "Shutting down services..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
        echo "Backend stopped"
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
        echo "Frontend stopped"
    fi
    exit 0
}

# Set up signal handlers
trap cleanup_on_exit SIGINT SIGTERM

# Main execution
echo "Starting Airtable Import application..."

# Clean up ports first
cleanup_all_ports

# Install dependencies if needed
if [ "$1" = "install" ] || [ ! -d "backend/node_modules" ] || [ ! -d "frontend/node_modules" ]; then
    echo "Installing dependencies..."
    
    echo "Installing backend dependencies..."
    cd backend && npm install
    cd ..
    
    echo "Installing frontend dependencies..."
    cd frontend && npm install
    cd ..
    
    echo "Dependencies installed"
fi

# Start backend
start_backend
BACKEND_PID=$!

# Start frontend
start_frontend
FRONTEND_PID=$!

echo ""
echo "🚀 Airtable Import application is running!"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:3001"
echo "   API:      http://localhost:3001/api"
echo ""
echo "Press Ctrl+C to stop all services"

# Keep the script running and wait for services
wait