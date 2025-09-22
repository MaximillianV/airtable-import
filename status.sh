#!/bin/bash

# Script to check application status

LOGS_DIR="logs"
PID_FILE="$LOGS_DIR/app.pid"

echo "=== Airtable Import Application Status ==="

# Check if PID file exists
if [ ! -f "$PID_FILE" ]; then
    echo "❌ Application not running (no PID file found)"
    echo ""
    echo "💡 To start: ./start-all.sh"
    exit 1
fi

# Read PIDs from file
BACKEND_PID=$(sed -n '1p' "$PID_FILE" 2>/dev/null)
FRONTEND_PID=$(sed -n '2p' "$PID_FILE" 2>/dev/null)
TIMESTAMP=$(sed -n '3p' "$PID_FILE" 2>/dev/null)

echo "Session started: $TIMESTAMP"
echo ""

# Check backend status
if [ -n "$BACKEND_PID" ]; then
    if kill -0 "$BACKEND_PID" 2>/dev/null; then
        echo "✅ Backend: Running (PID $BACKEND_PID)"
        
        # Test API health
        if curl -f http://localhost:3001/api/health >/dev/null 2>&1; then
            echo "   🌐 API: Responding on http://localhost:3001"
        else
            echo "   ⚠️  API: Port open but not responding"
        fi
    else
        echo "❌ Backend: Not running (stale PID)"
    fi
else
    echo "❌ Backend: No PID found"
fi

# Check frontend status
if [ -n "$FRONTEND_PID" ]; then
    if kill -0 "$FRONTEND_PID" 2>/dev/null; then
        echo "✅ Frontend: Running (PID $FRONTEND_PID)"
        
        # Test frontend
        if curl -f http://localhost:3000 >/dev/null 2>&1; then
            echo "   🌐 Web App: Available on http://localhost:3000"
        else
            echo "   ⚠️  Web App: Port open but not responding"
        fi
    else
        echo "❌ Frontend: Not running (stale PID)"
    fi
else
    echo "❌ Frontend: No PID found"
fi

echo ""

# Show log files
echo "📝 Current session logs:"
if [ -n "$TIMESTAMP" ]; then
    BACKEND_LOG="$LOGS_DIR/backend_$TIMESTAMP.log"
    FRONTEND_LOG="$LOGS_DIR/frontend_$TIMESTAMP.log"
    STARTUP_LOG="$LOGS_DIR/startup_$TIMESTAMP.log"
    
    if [ -f "$BACKEND_LOG" ]; then
        echo "   Backend:  $BACKEND_LOG ($(wc -l < "$BACKEND_LOG") lines)"
    fi
    if [ -f "$FRONTEND_LOG" ]; then
        echo "   Frontend: $FRONTEND_LOG ($(wc -l < "$FRONTEND_LOG") lines)"
    fi
    if [ -f "$STARTUP_LOG" ]; then
        echo "   Startup:  $STARTUP_LOG ($(wc -l < "$STARTUP_LOG") lines)"
    fi
fi

echo ""

# Show management commands
echo "💡 Management commands:"
echo "   Stop services:    ./stop-all.sh"
echo "   View logs:        ./view-logs.sh [backend|frontend|startup]"
echo "   Live backend:     ./view-logs.sh tail-backend"
echo "   Live frontend:    ./view-logs.sh tail-frontend"
echo "   Restart:          ./stop-all.sh && ./start-all.sh"

# Show port usage
echo ""
echo "🔌 Port usage:"
if lsof -ti:3001 >/dev/null 2>&1; then
    echo "   3001: Backend ($(lsof -ti:3001))"
else
    echo "   3001: Available"
fi

if lsof -ti:3000 >/dev/null 2>&1; then
    echo "   3000: Frontend ($(lsof -ti:3000))"
else
    echo "   3000: Available"
fi