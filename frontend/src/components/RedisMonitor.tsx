import React, { useState, useEffect } from 'react';
import redisAPI from '../services/redisAPI';

/**
 * Redis Monitor Component
 * 
 * Displays Redis connection status, session data, and cache statistics
 * Provides real-time monitoring and debugging capabilities
 */
interface RedisMonitorProps {
  className?: string;
  refreshInterval?: number; // Auto-refresh interval in milliseconds
  showSessions?: boolean;
  showCache?: boolean;
  showStats?: boolean;
}

interface RedisHealth {
  connected: boolean;
  status: string;
  info?: {
    version: string;
    mode: string;
    database: number;
    host: string;
    port: number;
    keys: number;
    memory: string;
    persistence: boolean;
  };
  error?: string;
}

interface RedisSession {
  sessionId: string;
  status: string;
  startTime: string;
  endTime?: string;
  tableNames: string[];
  progressCount: number;
}

interface RedisCacheStats {
  connected: boolean;
  cache: {
    hits: number;
    misses: number;
    hitRate: string;
    totalKeys: number;
    keysByType: Record<string, number>;
  };
}

const RedisMonitor: React.FC<RedisMonitorProps> = ({
  className = '',
  refreshInterval = 5000,
  showSessions = true,
  showCache = true,
  showStats = true
}) => {
  const [health, setHealth] = useState<RedisHealth | null>(null);
  const [sessions, setSessions] = useState<RedisSession[]>([]);
  const [cacheStats, setCacheStats] = useState<RedisCacheStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Auto-refresh data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch Redis health
        const healthData = await redisAPI.getHealth();
        setHealth(healthData);

        // Fetch sessions if enabled and Redis is connected
        if (showSessions && healthData.connected) {
          const sessionsData = await redisAPI.getSessions();
          setSessions((sessionsData?.sessions || []).slice(0, 10)); // Show latest 10
        }

        // Fetch cache stats if enabled and Redis is connected
        if (showCache && healthData.connected) {
          const cacheData = await redisAPI.getCacheStats();
          setCacheStats(cacheData);
        }

        setLastUpdated(new Date());
      } catch (error: any) {
        console.error('Error fetching Redis data:', error);
        setError(error.message || 'Failed to fetch Redis data');
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchData();

    // Set up auto-refresh
    const interval = setInterval(fetchData, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval, showSessions, showCache]);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ago`;
    } else if (minutes > 0) {
      return `${minutes}m ago`;
    } else {
      return 'Just now';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running':
        return '#3b82f6'; // Blue
      case 'completed':
        return '#10b981'; // Green
      case 'error':
      case 'failed':
        return '#ef4444'; // Red
      default:
        return '#6b7280'; // Gray
    }
  };

  if (loading && !health) {
    return (
      <div className={`redis-monitor ${className}`} style={styles.container}>
        <div style={styles.header}>
          <h3 style={styles.title}>Redis Status</h3>
          <div style={styles.loading}>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`redis-monitor ${className}`} style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Redis Monitor</h3>
        {lastUpdated && (
          <div style={styles.lastUpdated}>
            Updated: {lastUpdated.toLocaleTimeString()}
          </div>
        )}
      </div>

      {error && (
        <div style={styles.error}>
          ⚠️ Error: {error}
        </div>
      )}

      {/* Connection Status */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Connection Status</h4>
        <div style={{
          ...styles.statusCard,
          backgroundColor: health?.connected ? '#dcfce7' : '#fef2f2',
          borderColor: health?.connected ? '#10b981' : '#ef4444'
        }}>
          <div style={styles.statusRow}>
            <span style={styles.statusLabel}>Status:</span>
            <span style={{
              ...styles.statusValue,
              color: health?.connected ? '#10b981' : '#ef4444'
            }}>
              {health?.connected ? '✅ Connected' : '❌ Disconnected'}
            </span>
          </div>
          
          {health?.info && (
            <>
              <div style={styles.statusRow}>
                <span style={styles.statusLabel}>Server:</span>
                <span style={styles.statusValue}>
                  {health.info.host}:{health.info.port} (DB {health.info.database})
                </span>
              </div>
              <div style={styles.statusRow}>
                <span style={styles.statusLabel}>Version:</span>
                <span style={styles.statusValue}>{health.info.version}</span>
              </div>
              <div style={styles.statusRow}>
                <span style={styles.statusLabel}>Keys:</span>
                <span style={styles.statusValue}>{health.info.keys.toLocaleString()}</span>
              </div>
              <div style={styles.statusRow}>
                <span style={styles.statusLabel}>Memory:</span>
                <span style={styles.statusValue}>{health.info.memory}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Cache Statistics */}
      {showCache && cacheStats && (
        <div style={styles.section}>
          <h4 style={styles.sectionTitle}>Cache Statistics</h4>
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{cacheStats.cache.hitRate}</div>
              <div style={styles.statLabel}>Hit Rate</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{cacheStats.cache.totalKeys}</div>
              <div style={styles.statLabel}>Total Keys</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{cacheStats.cache.hits}</div>
              <div style={styles.statLabel}>Cache Hits</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{cacheStats.cache.misses}</div>
              <div style={styles.statLabel}>Cache Misses</div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Sessions */}
      {showSessions && sessions && sessions.length > 0 && (
        <div style={styles.section}>
          <h4 style={styles.sectionTitle}>Recent Sessions</h4>
          <div style={styles.sessionsList}>
            {sessions.map((session) => (
              <div key={session.sessionId} style={styles.sessionCard}>
                <div style={styles.sessionHeader}>
                  <div style={styles.sessionId}>
                    {session.sessionId.slice(-8)}
                  </div>
                  <div style={{
                    ...styles.sessionStatus,
                    backgroundColor: getStatusColor(session.status),
                  }}>
                    {session.status}
                  </div>
                </div>
                <div style={styles.sessionDetails}>
                  <div style={styles.sessionDetail}>
                    📅 {formatTimeAgo(session.startTime)}
                  </div>
                  <div style={styles.sessionDetail}>
                    📊 {session.tableNames?.length || 0} tables
                  </div>
                  <div style={styles.sessionDetail}>
                    🔄 {session.progressCount} progress items
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Styles
const styles = {
  container: {
    backgroundColor: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    borderBottom: '1px solid #e5e7eb',
    paddingBottom: '15px',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '600',
    color: '#111827',
  },
  lastUpdated: {
    fontSize: '12px',
    color: '#6b7280',
  },
  loading: {
    color: '#6b7280',
    fontSize: '14px',
  },
  error: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    padding: '12px',
    color: '#dc2626',
    marginBottom: '20px',
    fontSize: '14px',
  },
  section: {
    marginBottom: '25px',
  },
  sectionTitle: {
    margin: '0 0 15px 0',
    fontSize: '16px',
    fontWeight: '600',
    color: '#374151',
  },
  statusCard: {
    border: '2px solid',
    borderRadius: '8px',
    padding: '15px',
  },
  statusRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  } as React.CSSProperties,
  statusLabel: {
    fontSize: '14px',
    color: '#6b7280',
    fontWeight: '500',
  },
  statusValue: {
    fontSize: '14px',
    fontWeight: '600',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: '12px',
  },
  statCard: {
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    padding: '12px',
    textAlign: 'center' as const,
  },
  statValue: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#111827',
    marginBottom: '4px',
  },
  statLabel: {
    fontSize: '12px',
    color: '#6b7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  sessionsList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  },
  sessionCard: {
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    padding: '12px',
  },
  sessionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  } as React.CSSProperties,
  sessionId: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
    fontFamily: 'monospace',
  },
  sessionStatus: {
    fontSize: '11px',
    color: 'white',
    padding: '2px 8px',
    borderRadius: '12px',
    textTransform: 'uppercase' as const,
    fontWeight: '600',
  },
  sessionDetails: {
    display: 'flex',
    gap: '15px',
    flexWrap: 'wrap' as const,
  },
  sessionDetail: {
    fontSize: '12px',
    color: '#6b7280',
  },
};

export default RedisMonitor;