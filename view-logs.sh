#!/bin/bash

# Script to view and manage application logs

LOGS_DIR="logs"

if [ ! -d "$LOGS_DIR" ]; then
    echo "No logs directory found. Run the application first with ./start-all.sh"
    exit 1
fi

show_help() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  list           List all log files"
    echo "  backend        Show latest backend log"
    echo "  frontend       Show latest frontend log"
    echo "  startup        Show latest startup log"
    echo "  tail-backend   Follow backend logs in real-time"
    echo "  tail-frontend  Follow frontend logs in real-time"
    echo "  tail-startup   Follow startup logs in real-time"
    echo "  clean          Clean old log files (keep last 5)"
    echo "  help           Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 backend     # View latest backend log"
    echo "  $0 tail-backend # Follow backend logs live"
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