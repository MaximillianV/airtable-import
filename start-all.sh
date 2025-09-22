#!/bin/bash

# Script to start both frontend and backend services with comprehensive logging
# Services run in background, allowing terminal to be used for other commands

echo "=== Airtable Import Full Stack Startup ==="

# Create logs directory
LOGS_DIR="logs"
mkdir -p "$LOGS_DIR"

# PID file for process management
PID_FILE="$LOGS_DIR/app.pid"

# Get timestamp for log files
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKEND_LOG="$LOGS_DIR/backend_$TIMESTAMP.log"
FRONTEND_LOG="$LOGS_DIR/frontend_$TIMESTAMP.log"
STARTUP_LOG="$LOGS_DIR/startup_$TIMESTAMP.log"

# Function to check if app is already running
check_running() {
    if [ -f "$PID_FILE" ]; then
        local backend_pid=$(sed -n '1p' "$PID_FILE" 2>/dev/null)
        local frontend_pid=$(sed -n '2p' "$PID_FILE" 2>/dev/null)
        
        if [ -n "$backend_pid" ] && kill -0 "$backend_pid" 2>/dev/null; then
            echo "⚠️  Application is already running!"
            echo "   Backend PID: $backend_pid"
            if [ -n "$frontend_pid" ] && kill -0 "$frontend_pid" 2>/dev/null; then
                echo "   Frontend PID: $frontend_pid"
            fi
            echo ""
            echo "💡 To stop: ./stop-all.sh"
            echo "💡 To view logs: ./view-logs.sh"
            echo "💡 To restart: ./stop-all.sh && ./start-all.sh"
            return 1
        else
            # Clean up stale PID file
            rm -f "$PID_FILE"
        fi
    fi
    return 0
}

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

# Function to start backend with logging
start_backend() {
    echo "Starting backend server with logging to $BACKEND_LOG..."
    cd backend
    
    # Create .env if it doesn't exist
    if [ ! -f .env ]; then
        echo "Creating backend .env file..."
        ./start-server.sh create-env
    fi
    
    # Start backend and redirect all output to log file
    nohup npm run dev > "../$BACKEND_LOG" 2>&1 &
    BACKEND_PID=$!
    cd ..
    
    echo "Backend started with PID $BACKEND_PID"
    
    # Wait for backend to be ready
    echo "Waiting for backend to be ready..."
    local attempts=0
    local max_attempts=30
    
    while [ $attempts -lt $max_attempts ]; do
        if curl -f http://localhost:3001/api/health >/dev/null 2>&1; then
            echo "✅ Backend is running on http://localhost:3001"
            return 0
        fi
        sleep 1
        attempts=$((attempts + 1))
        if [ $((attempts % 5)) -eq 0 ]; then
            echo "  Attempt $attempts/$max_attempts..."
        fi
    done
    
    echo "❌ Backend failed to start within 30 seconds"
    echo "Backend log tail:"
    tail -20 "$BACKEND_LOG"
    kill $BACKEND_PID 2>/dev/null || true
    return 1
}

# Function to start frontend with logging
start_frontend() {
    echo "Starting frontend React app with logging to $FRONTEND_LOG..."
    cd frontend
    
    # Create .env if it doesn't exist
    if [ ! -f .env ]; then
        echo "Creating frontend .env file..."
        echo "REACT_APP_API_URL=http://localhost:3001/api" > .env
    fi
    
    # Start frontend and redirect all output to log file
    nohup npm start > "../$FRONTEND_LOG" 2>&1 &
    FRONTEND_PID=$!
    cd ..
    
    echo "Frontend started with PID $FRONTEND_PID"
    
    # Wait for frontend to be ready
    echo "Waiting for frontend to be ready..."
    local attempts=0
    local max_attempts=60
    
    while [ $attempts -lt $max_attempts ]; do
        if curl -f http://localhost:3000 >/dev/null 2>&1; then
            echo "✅ Frontend is running on http://localhost:3000"
            return 0
        fi
        sleep 1
        attempts=$((attempts + 1))
        
        # Show progress every 10 attempts
        if [ $((attempts % 10)) -eq 0 ]; then
            echo "  Attempt $attempts/$max_attempts..."
        fi
    done
    
    echo "❌ Frontend failed to start within 60 seconds"
    echo "Frontend log tail:"
    tail -20 "$FRONTEND_LOG"
    kill $FRONTEND_PID 2>/dev/null || true
    return 1
}

# Check if already running
if ! check_running; then
    exit 1
fi

# Log everything to startup log
{
    echo "Logging session started at $(date)"
    echo "Backend logs: $BACKEND_LOG"
    echo "Frontend logs: $FRONTEND_LOG"
    echo "Startup logs: $STARTUP_LOG"

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
    if start_backend; then
        echo "Backend startup successful"
    else
        echo "Backend startup failed, exiting..."
        exit 1
    fi

    # Start frontend
    if start_frontend; then
        echo "Frontend startup successful"
    else
        echo "Frontend startup failed, cleaning up..."
        kill $BACKEND_PID 2>/dev/null || true
        exit 1
    fi

    # Save PIDs for process management
    echo "$BACKEND_PID" > "$PID_FILE"
    echo "$FRONTEND_PID" >> "$PID_FILE"
    echo "$TIMESTAMP" >> "$PID_FILE"

    echo ""
    echo "🚀 Airtable Import application is running in background!"
    echo "   Frontend: http://localhost:3000"
    echo "   Backend:  http://localhost:3001"
    echo "   API:      http://localhost:3001/api"
    echo ""
    echo "📝 Logs are being written to:"
    echo "   Backend:  $BACKEND_LOG"
    echo "   Frontend: $FRONTEND_LOG"
    echo "   Startup:  $STARTUP_LOG"
    echo ""
    echo "💡 Management commands:"
    echo "   Stop services:    ./stop-all.sh"
    echo "   View logs:        ./view-logs.sh [backend|frontend|startup]"
    echo "   Live backend:     ./view-logs.sh tail-backend"
    echo "   Live frontend:    ./view-logs.sh tail-frontend"
    echo "   Check status:     ./status.sh"
    echo ""
    echo "✨ Terminal is now free for other commands!"

} >> "$STARTUP_LOG" 2>&1

# Also show summary to console
echo ""
echo "🚀 Airtable Import application started in background!"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:3001"
echo ""
echo "💡 Management commands:"
echo "   Stop:        ./stop-all.sh"
echo "   View logs:   ./view-logs.sh"
echo "   Status:      ./status.sh"
echo ""
echo "✨ Terminal is ready for other commands!"