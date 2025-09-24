import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { importAPI } from '../services/api';
import { ImportSession } from '../types';
import socketService from '../services/socket';

/**
 * Import Session Detail View Component
 * 
 * Provides detailed view of an import session with:
 * - Session overview and timeline
 * - Individual table status breakdown
 * - Error messages and diagnostics
 * - Retry functionality for failed tables
 * - Real-time progress updates via Socket.IO
 */

interface TableResult {
  tableName: string;
  success: boolean;
  mode?: string; // 'insert' | 'upsert' | 'sync'
  processedRecords: number;
  updatedRecords?: number;
  skippedRecords?: number;
  totalRecords: number;
  error?: string;
}

interface SessionDetailProps {}

const SessionDetail: React.FC<SessionDetailProps> = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  
  const [session, setSession] = useState<ImportSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryingTable, setRetryingTable] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setError('Session ID is required');
      setLoading(false);
      return;
    }

    loadSessionDetails();
    setupSocketListeners();

    // Cleanup on unmount
    return () => {
      // Socket cleanup handled by service
    };
  }, [sessionId]);

  /**
   * Load detailed session information from the API
   */
  const loadSessionDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const sessionData = await importAPI.getStatus(sessionId!);
      setSession(sessionData);
    } catch (err: any) {
      console.error('Error loading session details:', err);
      setError(err.message || 'Failed to load session details');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Setup Socket.IO listeners for real-time updates
   */
  const setupSocketListeners = () => {
    if (!socketService.isConnected()) {
      socketService.connect();
    }

    // Join the session room for updates
    if (sessionId) {
      socketService.joinSession(sessionId);
    }

    // Listen for session completion updates
    const unsubscribeSessionComplete = socketService.onSessionComplete((sessionData) => {
      if (sessionData.sessionId === sessionId) {
        console.log('Session detail received completion update:', sessionData);
        
        // Update session with latest completion data
        setSession(prev => prev ? {
          ...prev,
          status: sessionData.status.toLowerCase() as ImportSession['status'],
          endTime: sessionData.endTime,
          results: sessionData.results || prev.results
        } : null);
      }
    });

    // Listen for individual table progress updates
    const unsubscribeProgress = socketService.onProgressUpdate((progressData) => {
      if (progressData.table) {
        console.log('Session detail received progress update:', progressData);
        
        // Update specific table progress in session results
        setSession(prev => {
          if (!prev || !prev.results) return prev;
          
          const updatedResults = { ...prev.results };
          if (updatedResults[progressData.table]) {
            updatedResults[progressData.table] = {
              ...updatedResults[progressData.table],
              processedRecords: progressData.recordsProcessed || 0,
              totalRecords: progressData.totalRecords || updatedResults[progressData.table].totalRecords
            };
          }
          
          return {
            ...prev,
            results: updatedResults
          };
        });
      }
    });

    // Store unsubscribe functions for cleanup (handled by service)
  };

  /**
   * Retry a failed table import
   */
  const retryTable = async (tableName: string) => {
    try {
      setRetryingTable(tableName);
      
      // Call the retry API endpoint (we'll implement this next)
      await importAPI.retryTable(sessionId!, tableName);
      
      // Refresh session data to get updated status
      await loadSessionDetails();
      
      // Success feedback could go here (toast notification, etc.)
      console.log(`Successfully initiated retry for table: ${tableName}`);
      
    } catch (err: any) {
      console.error(`Error retrying table ${tableName}:`, err);
      setError(`Failed to retry table ${tableName}: ${err.message}`);
    } finally {
      setRetryingTable(null);
    }
  };

  /**
   * Calculate session statistics
   */
  const getSessionStats = () => {
    if (!session || !session.results) {
      return { total: 0, successful: 0, failed: 0, totalRecords: 0 };
    }

    const results = Object.values(session.results) as TableResult[];
    return {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      totalRecords: results.reduce((sum, r) => sum + (r.processedRecords || 0), 0)
    };
  };

  /**
   * Get status color for visual indicators
   */
  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'completed':
        return '#22c55e';
      case 'partial_failed':
      case 'partial-failed':
        return '#f59e0b';
      case 'failed':
      case 'error':
        return '#ef4444';
      case 'running':
      case 'pending':
        return '#3b82f6';
      default:
        return '#6b7280';
    }
  };

  /**
   * Format duration between two dates
   */
  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const diffMs = end.getTime() - start.getTime();
    
    const minutes = Math.floor(diffMs / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner}></div>
        <p>Loading session details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorCard}>
          <h2>Error Loading Session</h2>
          <p style={styles.errorMessage}>{error}</p>
          <div style={styles.errorActions}>
            <button onClick={loadSessionDetails} style={styles.retryButton}>
              Try Again
            </button>
            <Link to="/dashboard" style={styles.backButton}>
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div style={styles.container}>
        <div style={styles.errorCard}>
          <h2>Session Not Found</h2>
          <p>The requested import session could not be found.</p>
          <Link to="/dashboard" style={styles.backButton}>
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const stats = getSessionStats();
  const isActive = session.status === 'running' || session.status === 'starting';

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <Link to="/dashboard" style={styles.breadcrumb}>
            ← Dashboard
          </Link>
          <h1 style={styles.title}>
            Import Session {session.sessionId.slice(-8)}
          </h1>
          <div style={styles.statusBadge}>
            <span 
              style={{
                ...styles.statusIndicator,
                backgroundColor: getStatusColor(session.status)
              }}
            />
            {session.status.toUpperCase()}
          </div>
        </div>
      </div>

      <div style={styles.content}>
        {/* Session Overview */}
        <div style={styles.overviewSection}>
          <h2 style={styles.sectionTitle}>Session Overview</h2>
          
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statIcon}>📊</div>
              <div style={styles.statValue}>{stats.total}</div>
              <div style={styles.statLabel}>Total Tables</div>
            </div>
            
            <div style={styles.statCard}>
              <div style={styles.statIcon}>✅</div>
              <div style={styles.statValue}>{stats.successful}</div>
              <div style={styles.statLabel}>Successful</div>
            </div>
            
            <div style={styles.statCard}>
              <div style={styles.statIcon}>❌</div>
              <div style={styles.statValue}>{stats.failed}</div>
              <div style={styles.statLabel}>Failed</div>
            </div>
            
            <div style={styles.statCard}>
              <div style={styles.statIcon}>📝</div>
              <div style={styles.statValue}>{stats.totalRecords.toLocaleString()}</div>
              <div style={styles.statLabel}>Records Processed</div>
            </div>
          </div>

          <div style={styles.sessionMeta}>
            <div style={styles.metaItem}>
              <span style={styles.metaLabel}>Started:</span>
              <span style={styles.metaValue}>
                {new Date(session.startTime).toLocaleString()}
              </span>
            </div>
            
            {session.endTime && (
              <div style={styles.metaItem}>
                <span style={styles.metaLabel}>Completed:</span>
                <span style={styles.metaValue}>
                  {new Date(session.endTime).toLocaleString()}
                </span>
              </div>
            )}
            
            <div style={styles.metaItem}>
              <span style={styles.metaLabel}>Duration:</span>
              <span style={styles.metaValue}>
                {formatDuration(session.startTime, session.endTime)}
              </span>
            </div>
          </div>
        </div>

        {/* Table Results */}
        <div style={styles.tablesSection}>
          <h2 style={styles.sectionTitle}>Table Import Results</h2>
          
          {session.results && Object.keys(session.results).length > 0 ? (
            <div style={styles.tablesList}>
              {Object.entries(session.results).map(([tableName, result]) => {
                const tableResult = result as TableResult;
                const progressPercent = tableResult.totalRecords > 0 
                  ? Math.round((tableResult.processedRecords / tableResult.totalRecords) * 100)
                  : 0;

                return (
                  <div key={tableName} style={styles.tableCard}>
                    <div style={styles.tableHeader}>
                      <div style={styles.tableInfo}>
                        <h3 style={styles.tableName}>{tableName}</h3>
                        <div style={styles.tableStats}>
                          {tableResult.processedRecords.toLocaleString()} / {tableResult.totalRecords.toLocaleString()} records
                          {tableResult.mode && (
                            <span style={styles.tableMode}>({tableResult.mode})</span>
                          )}
                        </div>
                      </div>
                      
                      <div style={styles.tableActions}>
                        {tableResult.success ? (
                          <div style={styles.successBadge}>✅ Success</div>
                        ) : (
                          <div style={styles.actionGroup}>
                            <div style={styles.errorBadge}>❌ Failed</div>
                            {!isActive && (
                              <button
                                onClick={() => retryTable(tableName)}
                                disabled={retryingTable === tableName}
                                style={styles.retryTableButton}
                              >
                                {retryingTable === tableName ? '🔄 Retrying...' : '🔄 Retry'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div style={styles.progressContainer}>
                      <div style={styles.progressBar}>
                        <div 
                          style={{
                            ...styles.progressFill,
                            width: `${progressPercent}%`,
                            backgroundColor: tableResult.success ? '#22c55e' : '#ef4444'
                          }}
                        />
                      </div>
                      <span style={styles.progressText}>{progressPercent}%</span>
                    </div>

                    {/* Error Message */}
                    {tableResult.error && (
                      <div style={styles.errorDetails}>
                        <strong>Error:</strong> {tableResult.error}
                      </div>
                    )}

                    {/* Additional Details */}
                    {(tableResult.updatedRecords || tableResult.skippedRecords) && (
                      <div style={styles.additionalStats}>
                        {tableResult.updatedRecords && (
                          <span>Updated: {tableResult.updatedRecords.toLocaleString()}</span>
                        )}
                        {tableResult.skippedRecords && (
                          <span>Skipped: {tableResult.skippedRecords.toLocaleString()}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={styles.noResults}>
              <p>No table results available yet.</p>
              {isActive && <p>Import is still in progress...</p>}
            </div>
          )}
        </div>

        {/* Session Actions */}
        <div style={styles.actionsSection}>
          <button onClick={loadSessionDetails} style={styles.refreshButton}>
            🔄 Refresh
          </button>
          
          {stats.failed > 0 && !isActive && (
            <button 
              onClick={() => {
                // Retry all failed tables
                const failedTables = Object.entries(session.results || {})
                  .filter(([, result]) => !(result as TableResult).success)
                  .map(([tableName]) => tableName);
                
                failedTables.forEach(tableName => retryTable(tableName));
              }}
              style={styles.retryAllButton}
              disabled={retryingTable !== null}
            >
              🔄 Retry All Failed Tables
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: '#f8fafc',
    minHeight: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
  },
  
  loading: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
  },
  
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #f3f3f3',
    borderTop: '4px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '16px',
  },

  header: {
    backgroundColor: 'white',
    borderBottom: '1px solid #e5e7eb',
    padding: '24px',
  },
  
  headerContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  
  breadcrumb: {
    color: '#6b7280',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: '500',
  },
  
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#1f2937',
    margin: 0,
    flex: 1,
  },
  
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    backgroundColor: '#f3f4f6',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
  },
  
  statusIndicator: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },

  content: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '32px 24px',
  },

  overviewSection: {
    marginBottom: '32px',
  },
  
  sectionTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '16px',
  },
  
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  
  statCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    textAlign: 'center' as const,
  },
  
  statIcon: {
    fontSize: '24px',
    marginBottom: '8px',
  },
  
  statValue: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: '4px',
  },
  
  statLabel: {
    fontSize: '14px',
    color: '#6b7280',
  },

  sessionMeta: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '24px',
  },
  
  metaItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  
  metaLabel: {
    fontSize: '12px',
    color: '#6b7280',
    fontWeight: '500',
    textTransform: 'uppercase' as const,
  },
  
  metaValue: {
    fontSize: '14px',
    color: '#374151',
    fontWeight: '500',
  },

  tablesSection: {
    marginBottom: '32px',
  },
  
  tablesList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  },
  
  tableCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
  },
  
  tableHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '12px',
  },
  
  tableInfo: {
    flex: 1,
  },
  
  tableName: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1f2937',
    margin: '0 0 4px 0',
  },
  
  tableStats: {
    fontSize: '14px',
    color: '#6b7280',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  
  tableMode: {
    backgroundColor: '#f3f4f6',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
  },
  
  tableActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  
  actionGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  
  successBadge: {
    color: '#22c55e',
    fontWeight: '600',
    fontSize: '14px',
  },
  
  errorBadge: {
    color: '#ef4444',
    fontWeight: '600',
    fontSize: '14px',
  },
  
  retryTableButton: {
    padding: '6px 12px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
  },

  progressContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
  },
  
  progressBar: {
    flex: 1,
    height: '8px',
    backgroundColor: '#e5e7eb',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  
  progressFill: {
    height: '100%',
    transition: 'width 0.3s ease',
  },
  
  progressText: {
    fontSize: '12px',
    color: '#6b7280',
    fontWeight: '500',
    minWidth: '35px',
  },

  errorDetails: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    padding: '12px',
    fontSize: '14px',
    color: '#dc2626',
    marginBottom: '12px',
  },
  
  additionalStats: {
    display: 'flex',
    gap: '16px',
    fontSize: '12px',
    color: '#6b7280',
  },

  noResults: {
    backgroundColor: 'white',
    padding: '40px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    textAlign: 'center' as const,
    color: '#6b7280',
  },

  actionsSection: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
  },
  
  refreshButton: {
    padding: '10px 20px',
    backgroundColor: 'white',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    color: '#374151',
  },
  
  retryAllButton: {
    padding: '10px 20px',
    backgroundColor: '#f59e0b',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
  },

  errorCard: {
    backgroundColor: 'white',
    padding: '40px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    textAlign: 'center' as const,
    maxWidth: '500px',
    margin: '0 auto',
  },
  
  errorMessage: {
    color: '#ef4444',
    marginBottom: '24px',
  },
  
  errorActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
  },
  
  retryButton: {
    padding: '10px 20px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  
  backButton: {
    padding: '10px 20px',
    backgroundColor: 'white',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    textDecoration: 'none',
    color: '#374151',
  },
};

export default SessionDetail;