#!/bin/bash

# Script to stop all running services

LOGS_DIR="logs"
PID_FILE="$LOGS_DIR/app.pid"

echo "=== Stopping Airtable Import Services ==="

if [ ! -f "$PID_FILE" ]; then
    echo "⚠️  No running services found (PID file missing)"
    echo "💡 If services are running, manually stop them:"
    echo "   lsof -ti:3000 | xargs kill -9"
    echo "   lsof -ti:3001 | xargs kill -9"
    exit 1
fi

# Read PIDs from file
BACKEND_PID=$(sed -n '1p' "$PID_FILE" 2>/dev/null)
FRONTEND_PID=$(sed -n '2p' "$PID_FILE" 2>/dev/null)
TIMESTAMP=$(sed -n '3p' "$PID_FILE" 2>/dev/null)

echo "Found PIDs from session $TIMESTAMP:"
echo "  Backend PID: $BACKEND_PID"
echo "  Frontend PID: $FRONTEND_PID"

# Stop backend
if [ -n "$BACKEND_PID" ]; then
    if kill -0 "$BACKEND_PID" 2>/dev/null; then
        echo "Stopping backend (PID $BACKEND_PID)..."
        kill "$BACKEND_PID" 2>/dev/null
        
        # Wait a moment, then force kill if needed
        sleep 2
        if kill -0 "$BACKEND_PID" 2>/dev/null; then
            echo "Force killing backend..."
            kill -9 "$BACKEND_PID" 2>/dev/null
        fi
        echo "✅ Backend stopped"
    else
        echo "⚠️  Backend process not running"
    fi
fi

# Stop frontend
if [ -n "$FRONTEND_PID" ]; then
    if kill -0 "$FRONTEND_PID" 2>/dev/null; then
        echo "Stopping frontend (PID $FRONTEND_PID)..."
        kill "$FRONTEND_PID" 2>/dev/null
        
        # Wait a moment, then force kill if needed
        sleep 2
        if kill -0 "$FRONTEND_PID" 2>/dev/null; then
            echo "Force killing frontend..."
            kill -9 "$FRONTEND_PID" 2>/dev/null
        fi
        echo "✅ Frontend stopped"
    else
        echo "⚠️  Frontend process not running"
    fi
fi

# Clean up any remaining processes on the ports
echo "Cleaning up ports 3000 and 3001..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

# Check if we should stop Redis (only if we started it)
if [ -f "$LOGS_DIR/redis_started_by_app" ]; then
    echo "Stopping Redis server that was started by this application..."
    if redis-cli shutdown > /dev/null 2>&1; then
        echo "✅ Redis stopped"
    else
        echo "⚠️  Redis may have already been stopped or was not running"
    fi
    rm -f "$LOGS_DIR/redis_started_by_app"
else
    echo "ℹ️  Redis left running (was already running or managed externally)"
fi

# Remove PID file
rm -f "$PID_FILE"

echo ""
echo "🛑 All services stopped"
echo ""
echo "💡 Session logs are still available:"
if [ -n "$TIMESTAMP" ]; then
    echo "   Backend:  $LOGS_DIR/backend_$TIMESTAMP.log"
    echo "   Frontend: $LOGS_DIR/frontend_$TIMESTAMP.log"
    echo "   Startup:  $LOGS_DIR/startup_$TIMESTAMP.log"
fi
echo ""
echo "💡 To start again: ./start-all.sh"