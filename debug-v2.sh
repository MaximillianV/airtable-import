#!/bin/bash
# Ultimate Troubleshooting Script for Airtable Import V2
# Provides comprehensive monitoring for debugging

echo "🚀 Airtable Import V2 - Ultimate Troubleshooter"
echo "============================================="
echo "📅 Started: $(date)"
echo ""

# Ensure application is running
start_application() {
    echo "🔄 Starting application with enhanced logging..."
    ./start-all.sh
    sleep 5
    
    # Verify services are running
    backend_pid=$(lsof -ti:3001 2>/dev/null)
    frontend_pid=$(lsof -ti:3000 2>/dev/null)
    
    if [ -n "$backend_pid" ] && [ -n "$frontend_pid" ]; then
        echo "✅ Application started successfully"
        echo "   - Backend PID: $backend_pid (port 3001)"
        echo "   - Frontend PID: $frontend_pid (port 3000)"
        return 0
    else
        echo "❌ Failed to start application properly"
        return 1
    fi
}

# Monitor V2 Import workflow specifically
monitor_v2_workflow() {
    echo ""
    echo "🔗 V2 Import Workflow Monitor"
    echo "============================"
    
    # Create a temporary log file for this session
    V2_LOG="/tmp/v2_import_debug_$(date +%s).log"
    touch "$V2_LOG"
    
    echo "📝 Logging V2 activity to: $V2_LOG"
    
    # Background monitoring function
    {
        while true; do
            timestamp=$(date '+%H:%M:%S')
            
            # Check for backend V2 activity
            backend_pid=$(pgrep -f "node.*index.js" | head -1)
            if [ -n "$backend_pid" ]; then
                # Monitor CPU usage as indicator of processing
                cpu_usage=$(ps -p $backend_pid -o %cpu --no-headers 2>/dev/null | tr -d ' ')
                if [ -n "$cpu_usage" ] && (( $(echo "$cpu_usage > 1.0" | bc -l 2>/dev/null || echo 0) )); then
                    echo "[$timestamp] 🔥 Backend active - CPU: ${cpu_usage}%" >> "$V2_LOG"
                fi
            fi
            
            # Check for database connections
            db_connections=$(netstat -an 2>/dev/null | grep -c ":5432.*ESTABLISHED" || echo 0)
            if [ "$db_connections" -gt 0 ]; then
                echo "[$timestamp] 🗄️  Active DB connections: $db_connections" >> "$V2_LOG"
            fi
            
            # Monitor for specific V2 API calls
            api_calls=$(netstat -an 2>/dev/null | grep -c "3001.*ESTABLISHED" || echo 0)
            if [ "$api_calls" -gt 2 ]; then  # More than baseline connections
                echo "[$timestamp] 📡 High API activity - connections: $api_calls" >> "$V2_LOG"
            fi
            
            sleep 2
        done
    } &
    MONITOR_PID=$!
    
    # Show live log updates
    echo "📊 Live V2 Activity Monitor (Press Ctrl+C to stop):"
    echo "---------------------------------------------------"
    tail -f "$V2_LOG" &
    TAIL_PID=$!
    
    # Cleanup function
    cleanup_monitoring() {
        echo ""
        echo "🛑 Stopping monitors..."
        kill $MONITOR_PID 2>/dev/null || true
        kill $TAIL_PID 2>/dev/null || true
        
        echo "📋 Final Activity Summary:"
        echo "========================="
        wc -l "$V2_LOG" | awk '{print "Total events logged: " $1}'
        
        if [ -s "$V2_LOG" ]; then
            echo ""
            echo "🔍 Recent activity:"
            tail -10 "$V2_LOG"
        fi
        
        echo ""
        echo "📄 Full log saved to: $V2_LOG"
        exit 0
    }
    
    trap cleanup_monitoring INT TERM
    
    # Wait for user interrupt
    while true; do
        sleep 1
    done
}

# Test V2 Import API endpoints
test_v2_endpoints() {
    echo ""
    echo "🧪 V2 Import API Testing"
    echo "======================="
    
    # Get auth token
    echo "🔐 Getting authentication token..."
    auth_response=$(curl -s -X POST http://localhost:3001/api/auth/login \
        -H "Content-Type: application/json" \
        -d '{"email":"admin@example.com","password":"admin123"}' 2>/dev/null)
    
    if echo "$auth_response" | grep -q "token"; then
        token=$(echo "$auth_response" | jq -r '.token' 2>/dev/null)
        echo "✅ Authentication successful"
        
        echo ""
        echo "🔍 Testing V2 table discovery..."
        discovery_response=$(curl -s -X GET "http://localhost:3001/api/v2-import/discover-tables" \
            -H "Authorization: Bearer $token" \
            -H "Content-Type: application/json")
        
        if echo "$discovery_response" | grep -q "tables"; then
            table_count=$(echo "$discovery_response" | jq length 2>/dev/null || echo "unknown")
            echo "✅ Table discovery successful - Found $table_count tables"
        else
            echo "❌ Table discovery failed"
            echo "Response: $discovery_response"
        fi
        
        echo ""
        echo "🎯 Ready for V2 Import testing!"
        echo "You can now run V2 import phases while this script monitors the activity."
        
    else
        echo "❌ Authentication failed"
        echo "Response: $auth_response"
        return 1
    fi
}

# Main execution
main() {
    case "${1:-monitor}" in
        "start")
            start_application
            ;;
        "monitor")
            if ! start_application; then
                echo "Failed to start application. Exiting."
                exit 1
            fi
            test_v2_endpoints
            monitor_v2_workflow
            ;;
        "test")
            test_v2_endpoints
            ;;
        "logs")
            ./view-logs.sh live
            ;;
        *)
            echo "Usage: $0 [start|monitor|test|logs]"
            echo ""
            echo "Commands:"
            echo "  start   - Start the application only"
            echo "  monitor - Full monitoring (default) - start app + monitor V2 workflow"
            echo "  test    - Test V2 API endpoints only"
            echo "  logs    - Show live application logs"
            echo ""
            echo "Recommended: $0 monitor"
            ;;
    esac
}

main "$@"