#!/bin/bash

# Script to view and manage application logs

LOGS_DIR="logs"

if [ ! -d "$LOGS_DIR" ]; then
    echo "No logs directory found. Run the application first with ./start-all.sh"
    exit 1
fi

show_help() {
    echo "=== 🔍 Airtable Import - Enhanced Log Viewer ==="
    echo "Usage: $0 [command]"
    echo ""
    echo "📋 Log File Commands:"
    echo "  list           List all log files"
    echo "  backend        Show latest backend log"
    echo "  frontend       Show latest frontend log"
    echo "  startup        Show latest startup log"
    echo "  tail-backend   Follow backend logs in real-time"
    echo "  tail-frontend  Follow frontend logs in real-time"
    echo "  tail-startup   Follow startup logs in real-time"
    echo ""
    echo "🔄 Live Monitoring Commands:"
    echo "  live           Live combined backend + frontend monitoring"
    echo "  processes      Monitor running processes (CPU/Memory)"
    echo "  status         Show current application status"
    echo "  api-test       Test API endpoints and show responses"
    echo "  v2-debug       Monitor V2 import session logs specifically"
    echo ""
    echo "🛠️ Utility Commands:"
    echo "  clean          Clean old log files (keep last 5)"
    echo "  help           Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 live        # Live monitoring of all logs"
    echo "  $0 v2-debug    # Debug V2 import issues"
    echo "  $0 api-test    # Test API connectivity"
}

list_logs() {
    echo "Available log files:"
    ls -la "$LOGS_DIR"/*.log 2>/dev/null | while read -r line; do
        echo "  $line"
    done
}

get_latest_log() {
    local prefix="$1"
    ls -t "$LOGS_DIR"/${prefix}_*.log 2>/dev/null | head -1
}

show_log() {
    local prefix="$1"
    local logfile=$(get_latest_log "$prefix")
    
    if [ -z "$logfile" ]; then
        echo "No $prefix log files found"
        return 1
    fi
    
    echo "=== Latest $prefix log: $logfile ==="
    cat "$logfile"
}

tail_log() {
    local prefix="$1"
    local logfile=$(get_latest_log "$prefix")
    
    if [ -z "$logfile" ]; then
        echo "No $prefix log files found"
        return 1
    fi
    
    echo "Following $prefix log: $logfile"
    echo "Press Ctrl+C to stop"
    tail -f "$logfile"
}

clean_logs() {
    echo "Cleaning old log files (keeping latest 5)..."
    
    for prefix in "backend" "frontend" "startup"; do
        local count=$(ls "$LOGS_DIR"/${prefix}_*.log 2>/dev/null | wc -l)
        if [ "$count" -gt 5 ]; then
            echo "Cleaning $prefix logs ($count files, keeping 5)..."
            ls -t "$LOGS_DIR"/${prefix}_*.log | tail -n +6 | xargs rm -f
        fi
    done
    
    echo "Log cleanup completed"
}

case "$1" in
    "list")
        list_logs
        ;;
    "backend")
        show_log "backend"
        ;;
    "frontend")
        show_log "frontend"
        ;;
    "startup")
        show_log "startup"
        ;;
    "tail-backend")
        tail_log "backend"
        ;;
    "tail-frontend")
        tail_log "frontend"
        ;;
    "tail-startup")
        tail_log "startup"
        ;;
    "clean")
        clean_logs
        ;;
    "live")
        live_monitoring
        ;;
    "processes")
        monitor_processes
        ;;
    "status")
        show_status
        ;;
    "api-test")
        test_api_endpoints
        ;;
    "v2-debug")
        v2_debug_monitor
        ;;
    "help"|*)
        show_help
        ;;
esac

# Enhanced monitoring functions
live_monitoring() {
    echo "🔄 Starting Live Monitoring - Press Ctrl+C to exit"
    echo "=================================================="
    
    # Function to show timestamped output
    timestamp_output() {
        while IFS= read -r line; do
            echo "[$(date '+%H:%M:%S')] $line"
        done
    }
    
    # Start background monitoring
    {
        echo "🖥️  Monitoring Backend Process..."
        backend_pid=$(pgrep -f "node.*index.js" | head -1)
        if [ -n "$backend_pid" ]; then
            echo "📡 Backend PID: $backend_pid"
            # Monitor backend with strace for system calls
            timeout 60 strace -p $backend_pid -e trace=write 2>&1 | grep -E "(HTTP|POST|GET|Error|Success)" | timestamp_output &
        fi
    } &
    
    # Monitor log files if they exist
    if [ -d "$LOGS_DIR" ]; then
        echo "📄 Monitoring Log Files..."
        tail -f "$LOGS_DIR"/*.log 2>/dev/null | timestamp_output &
    fi
    
    # Show periodic status updates
    while true; do
        echo ""
        echo "⏰ Status Update - $(date)"
        show_status
        sleep 15
    done
}

monitor_processes() {
    echo "📊 Process Monitor - Press Ctrl+C to exit"
    echo "========================================"
    
    while true; do
        clear
        echo "📅 $(date)"
        echo ""
        
        echo "🖥️  Backend Processes:"
        ps aux | head -1  # Header
        ps aux | grep -E "(node.*index|nodemon)" | grep -v grep | head -3
        echo ""
        
        echo "🎨 Frontend Processes:"
        ps aux | head -1  # Header  
        ps aux | grep -E "(react-scripts|webpack)" | grep -v grep | head -3
        echo ""
        
        echo "🌐 Port Usage:"
        netstat -tlnp 2>/dev/null | grep -E ":(3000|3001|5432)" || echo "No services on expected ports"
        echo ""
        
        echo "💾 System Resources:"
        free -h | head -2
        
        sleep 5
    done
}

show_status() {
    echo "📋 Application Status:"
    
    # Check ports
    backend_pid=$(lsof -ti:3001 2>/dev/null)
    frontend_pid=$(lsof -ti:3000 2>/dev/null)
    
    if [ -n "$backend_pid" ]; then
        echo "✅ Backend: Running on port 3001 (PID: $backend_pid)"
    else
        echo "❌ Backend: Not running on port 3001"
    fi
    
    if [ -n "$frontend_pid" ]; then
        echo "✅ Frontend: Running on port 3000 (PID: $frontend_pid)"
    else
        echo "❌ Frontend: Not running on port 3000"
    fi
    
    # Check database
    pg_isready -h localhost -p 5432 >/dev/null 2>&1 && echo "✅ PostgreSQL: Ready" || echo "❌ PostgreSQL: Not available"
}

test_api_endpoints() {
    echo "🧪 Testing API Endpoints"
    echo "======================="
    
    # Test health endpoint
    echo "🔍 Testing Health Endpoint:"
    curl -s -w "Status: %{http_code}, Time: %{time_total}s\n" http://localhost:3001/api/health 2>/dev/null || echo "❌ Health endpoint failed"
    
    echo ""
    echo "🔐 Testing Auth Login:"
    response=$(curl -s -X POST http://localhost:3001/api/auth/login \
        -H "Content-Type: application/json" \
        -d '{"email":"admin@example.com","password":"admin123"}' \
        -w "Status: %{http_code}")
    
    if echo "$response" | grep -q "token"; then
        echo "✅ Login successful"
        token=$(echo "$response" | jq -r '.token' 2>/dev/null | head -1)
        echo "🎫 Token: ${token:0:30}..."
        
        echo ""
        echo "📋 Testing V2 Table Discovery:"
        curl -s -X GET "http://localhost:3001/api/v2-import/discover-tables" \
            -H "Authorization: Bearer $token" \
            -w "Status: %{http_code}\n" | head -5
    else
        echo "❌ Login failed"
        echo "$response"
    fi
}

v2_debug_monitor() {
    echo "🔗 V2 Import Debug Monitor - Press Ctrl+C to exit"
    echo "=============================================="
    
    # Check for V2 session activity
    echo "🔍 Checking for active V2 sessions..."
    
    # Monitor backend for V2-related logs
    backend_pid=$(pgrep -f "node.*index.js" | head -1)
    if [ -n "$backend_pid" ]; then
        echo "📡 Monitoring V2 import activity (PID: $backend_pid)"
        
        # Use journalctl or dmesg to catch system logs
        echo "📝 Starting V2 activity monitoring..."
        (
            # Try multiple monitoring approaches
            timeout 30 strace -p $backend_pid -e trace=write 2>&1 | grep -i -E "(v2|import|relationship|phase)" &
            
            # Monitor network activity on API ports
            timeout 30 netstat -c | grep -E "(3001|3000)" &
            
            # Show periodic status
            while true; do
                echo "[$(date '+%H:%M:%S')] V2 Status Check - Monitoring for import activity..."
                sleep 10
            done
        )
    else
        echo "❌ Backend process not found for monitoring"
    fi
}
    "help"|"")
        show_help
        ;;
    *)
        echo "Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac