import React, { useState, useEffect, useRef, useCallback } from 'react';
import { theme } from '../theme';

/**
 * Interface for debug log entries displayed in the console.
 * Includes timestamp, level, and message for comprehensive logging.
 */
interface DebugLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  details?: any;
}

/**
 * Props interface for the DebugConsole component.
 * Allows control over visibility and provides callback for clearing logs.
 */
interface DebugConsoleProps {
  /** Whether the debug console should be visible */
  isVisible: boolean;
  /** Callback function to toggle console visibility */
  onToggle: () => void;
  /** Optional maximum number of log entries to keep in memory */
  maxEntries?: number;
}

/**
 * DebugConsole component provides real-time logging during import operations.
 * Shows timestamped log entries with different severity levels and auto-scrolling.
 * Only visible when debug mode is enabled in settings.
 */
const DebugConsole: React.FC<DebugConsoleProps> = ({ 
  isVisible, 
  onToggle, 
  maxEntries = 100 
}) => {
  // State for storing log entries
  const [logs, setLogs] = useState<DebugLogEntry[]>([]);
  
  // Reference to the logs container for auto-scrolling
  const logsContainerRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs]);

  /**
   * Adds a new log entry to the console.
   * Automatically trims old entries if maxEntries limit is exceeded.
   */
  const addLog = useCallback((level: DebugLogEntry['level'], message: string, details?: any) => {
    const newLog: DebugLogEntry = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
      details
    };

    setLogs(prev => {
      const newLogs = [...prev, newLog];
      
      // Trim logs if we exceed maxEntries
      if (newLogs.length > maxEntries) {
        return newLogs.slice(newLogs.length - maxEntries);
      }
      
      return newLogs;
    });
  }, [maxEntries]);

  /**
   * Clears all log entries from the console.
   */
  const clearLogs = () => {
    setLogs([]);
  };

  /**
   * Set up Socket.IO listeners for debug messages and expose global debug function.
   * Listens for 'debug-log' events from the backend during import processes.
   */
  useEffect(() => {
    let unsubscribeDebug: (() => void) | undefined;

    // Import socket service and set up debug listener
    import('../services/socket').then(({ socketService }) => {
      // Listen for debug messages from backend
      unsubscribeDebug = socketService.onDebugLog((data: any) => {
        addLog(data.level || 'info', data.message, data.data);
      });
    });

    // Create global debug logger function for manual debugging
    (window as any).debugLog = addLog;
    
    // Initial welcome message
    if (isVisible) {
      addLog('info', '🚀 Debug console initialized - listening for import events');
    }
    
    // Cleanup on unmount
    return () => {
      if (unsubscribeDebug) {
        unsubscribeDebug();
      }
      delete (window as any).debugLog;
    };
  }, [isVisible, addLog]);

  /**
   * Determines the color for log entries based on their level.
   */
  const getLogLevelColor = (level: DebugLogEntry['level']): string => {
    switch (level) {
      case 'error':
        return theme.colors.semantic.error;
      case 'warn':
        return theme.colors.semantic.warning;
      case 'success':
        return theme.colors.semantic.success;
      case 'info':
      default:
        return theme.colors.neutral[600];
    }
  };

  /**
   * Gets the icon for each log level.
   */
  const getLogLevelIcon = (level: DebugLogEntry['level']): string => {
    switch (level) {
      case 'error':
        return '❌';
      case 'warn':
        return '⚠️';
      case 'success':
        return '✅';
      case 'info':
      default:
        return 'ℹ️';
    }
  };

  // Don't render if not visible
  if (!isVisible) {
    return null;
  }

  return (
    <div style={styles.debugConsole}>
      {/* Console Header */}
      <div style={styles.consoleHeader}>
        <div style={styles.consoleTitle}>
          <span style={styles.consoleIcon}>🔧</span>
          <h3 style={styles.consoleTitleText}>Debug Console</h3>
          <span style={styles.logCount}>({logs.length} entries)</span>
        </div>
        
        <div style={styles.consoleActions}>
          <button
            onClick={clearLogs}
            style={styles.clearButton}
            disabled={logs.length === 0}
          >
            Clear
          </button>
          <button
            onClick={onToggle}
            style={styles.toggleButton}
          >
            ❌
          </button>
        </div>
      </div>

      {/* Console Content */}
      <div 
        ref={logsContainerRef}
        style={styles.logsContainer}
      >
        {logs.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyStateText}>
              No debug logs yet. Start an import to see real-time logging information.
            </p>
          </div>
        ) : (
          logs.map(log => (
            <div key={log.id} style={styles.logEntry}>
              <div style={styles.logHeader}>
                <span style={styles.logIcon}>
                  {getLogLevelIcon(log.level)}
                </span>
                <span style={styles.logTimestamp}>
                  {log.timestamp}
                </span>
                <span 
                  style={{
                    ...styles.logLevel,
                    color: getLogLevelColor(log.level)
                  }}
                >
                  {log.level.toUpperCase()}
                </span>
              </div>
              
              <div style={styles.logMessage}>
                {log.message}
              </div>
              
              {log.details && (
                <div style={styles.logDetails}>
                  <pre>{JSON.stringify(log.details, null, 2)}</pre>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

/**
 * Styles object for the debug console component.
 * Uses theme values for consistent design system integration.
 */
const styles = {
  debugConsole: {
    position: 'fixed',
    bottom: theme.spacing.lg,
    right: theme.spacing.lg,
    width: '600px',
    maxHeight: '400px',
    backgroundColor: theme.colors.neutral[900],
    color: theme.colors.neutral[100],
    borderRadius: theme.borderRadius.lg,
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    fontSize: '13px',
    fontFamily: 'Monaco, Consolas, "Courier New", monospace'
  } as React.CSSProperties,

  consoleHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.sm,
    borderBottom: `1px solid ${theme.colors.neutral[600]}`,
    backgroundColor: theme.colors.neutral[900]
  } as React.CSSProperties,

  consoleTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs
  } as React.CSSProperties,

  consoleIcon: {
    fontSize: '16px'
  } as React.CSSProperties,

  consoleTitleText: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 600,
    color: theme.colors.neutral[100]
  } as React.CSSProperties,

  logCount: {
    fontSize: '12px',
    color: theme.colors.neutral[400]
  } as React.CSSProperties,

  consoleActions: {
    display: 'flex',
    gap: theme.spacing.xs
  } as React.CSSProperties,

  clearButton: {
    padding: '4px 8px',
    fontSize: '12px',
    backgroundColor: theme.colors.neutral[600],
    color: theme.colors.neutral[200],
    border: 'none',
    borderRadius: theme.borderRadius.sm,
    cursor: 'pointer'
  } as React.CSSProperties,

  toggleButton: {
    padding: '4px 8px',
    fontSize: '12px',
    backgroundColor: 'transparent',
    color: theme.colors.neutral[400],
    border: 'none',
    cursor: 'pointer'
  } as React.CSSProperties,

  logsContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: theme.spacing.sm,
    maxHeight: '320px'
  } as React.CSSProperties,

  emptyState: {
    textAlign: 'center',
    padding: theme.spacing.xl,
    color: theme.colors.neutral[400]
  } as React.CSSProperties,

  emptyStateText: {
    margin: 0,
    fontSize: '13px',
    lineHeight: 1.5
  } as React.CSSProperties,

  logEntry: {
    marginBottom: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    borderBottom: `1px solid ${theme.colors.neutral[200]}`
  } as React.CSSProperties,

  logHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs
  } as React.CSSProperties,

  logIcon: {
    fontSize: '12px'
  } as React.CSSProperties,

  logTimestamp: {
    fontSize: '11px',
    color: theme.colors.neutral[400]
  } as React.CSSProperties,

  logLevel: {
    fontSize: '11px',
    fontWeight: 600
  } as React.CSSProperties,

  logMessage: {
    lineHeight: 1.4,
    wordBreak: 'break-word'
  } as React.CSSProperties,

  logDetails: {
    marginTop: theme.spacing.xs,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.neutral[900],
    borderRadius: theme.borderRadius.sm,
    fontSize: '11px',
    overflow: 'auto'
  } as React.CSSProperties
};

export default DebugConsole;