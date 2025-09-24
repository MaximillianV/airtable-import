import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { settingsAPI, importAPI } from '../services/api';
import { ImportSession } from '../types';
import socketService from '../services/socket';

const Dashboard: React.FC = () => {
  const [sessions, setSessions] = useState<ImportSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasSettings, setHasSettings] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
    
    // Connect to Socket.IO for real-time session updates
    if (!socketService.isConnected()) {
      socketService.connect();
    }

    // Listen for session completion events to update the dashboard in real-time
    const unsubscribeSessionComplete = socketService.onSessionComplete((sessionData) => {
      console.log('Dashboard received session completion:', sessionData);
      
      // Update the sessions list with the completed session data
      setSessions(prevSessions => {
        return prevSessions.map(session => {
          if (session.sessionId === sessionData.sessionId) {
            return {
              ...session,
              status: sessionData.status.toLowerCase(), // Convert COMPLETED/PARTIAL_FAILED to lowercase
              endTime: sessionData.endTime,
              processedRecords: sessionData.processedRecords || 0,
              results: sessionData.results || session.results
            };
          }
          return session;
        });
      });
    });

    // Cleanup on unmount
    return () => {
      unsubscribeSessionComplete();
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Check if user has configured settings
      const settings = await settingsAPI.get();
      setHasSettings(!!(settings.airtableApiKey && settings.airtableBaseId && settings.databaseUrl));
      
      // Load import sessions
      try {
        const sessionsData = await importAPI.getSessions();
        setSessions(sessionsData);
      } catch (error) {
        // It's okay if there are no sessions yet
        setSessions([]);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner}></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Page Header */}
      <div style={styles.pageHeader}>
        <h1 style={styles.pageTitle}>Dashboard</h1>
        <p style={styles.pageDescription}>
          Welcome to your Airtable Import system. Monitor your imports and manage your data.
        </p>
      </div>

      <div style={styles.content}>
        {!hasSettings ? (
          <div style={styles.setupCard}>
            <div style={styles.setupIcon}>⚙️</div>
            <h2 style={styles.setupTitle}>Get Started</h2>
            <p style={styles.setupDescription}>
              Before you can start importing from Airtable, you need to configure your connection settings.
            </p>
            <Link to="/admin/settings" style={styles.primaryButton}>
              Configure Settings
            </Link>
          </div>
        ) : (
          <div style={styles.mainContent}>
            {/* Quick Stats */}
            <div style={styles.statsGrid}>
              <div style={styles.statCard}>
                <div style={styles.statIcon}>📊</div>
                <div style={styles.statContent}>
                  <div style={styles.statValue}>{sessions.length}</div>
                  <div style={styles.statLabel}>Total Sessions</div>
                </div>
              </div>
              
              <div style={styles.statCard}>
                <div style={styles.statIcon}>✅</div>
                <div style={styles.statContent}>
                  <div style={styles.statValue}>
                    {sessions.filter(s => s.status === 'completed').length}
                  </div>
                  <div style={styles.statLabel}>Successful Imports</div>
                </div>
              </div>
              
              <div style={styles.statCard}>
                <div style={styles.statIcon}>🚀</div>
                <div style={styles.statContent}>
                  <div style={styles.statValue}>
                    {sessions.reduce((total, session) => {
                      if (!session.results) return total;
                      // session.results is an object with table names as keys
                      const tableResults = Object.values(session.results);
                      return total + tableResults.reduce((sum: number, result: any) => 
                        sum + (result.processedRecords || result.recordsImported || 0), 0
                      );
                    }, 0)}
                  </div>
                  <div style={styles.statLabel}>Records Imported</div>
                </div>
              </div>
            </div>

            {/* Action Cards */}
            <div style={styles.actionCards}>
              <div style={styles.card}>
                <div style={styles.cardIcon}>📥</div>
                <h3 style={styles.cardTitle}>Start New Import</h3>
                <p style={styles.cardDescription}>
                  Import tables from your Airtable base to PostgreSQL database.
                </p>
                <Link to="/admin/import" style={styles.primaryButton}>
                  Start Import
                </Link>
              </div>
              
              <div style={styles.card}>
                <div style={styles.cardIcon}>⚙️</div>
                <h3 style={styles.cardTitle}>Manage Settings</h3>
                <p style={styles.cardDescription}>
                  Configure your Airtable and database connections, view system status.
                </p>
                <Link to="/admin/settings" style={styles.secondaryButton}>
                  View Settings
                </Link>
              </div>
              
              <div style={styles.card}>
                <div style={styles.cardIcon}>👥</div>
                <h3 style={styles.cardTitle}>User Management</h3>
                <p style={styles.cardDescription}>
                  Manage users, roles, and permissions for your import system.
                </p>
                <Link to="/admin/users" style={styles.secondaryButton}>
                  Manage Users
                </Link>
              </div>
            </div>

            <div style={styles.sessionsSection}>
              <h2>Recent Import Sessions</h2>
              {sessions.length === 0 ? (
                <p style={styles.noSessions}>No import sessions yet. Start your first import!</p>
              ) : (
                <div style={styles.sessionsList}>
                  {sessions.slice(0, 5).map((session) => (
                    <Link 
                      key={session.sessionId} 
                      to={`/admin/sessions/${session.sessionId}`}
                      style={styles.sessionLink}
                      className="session-link"
                    >
                      <div style={styles.sessionCard} className="session-card">
                        <div style={styles.sessionHeader}>
                          <span style={styles.sessionId}>Session: {session.sessionId.slice(-8)}</span>
                          <span style={{
                            ...styles.sessionStatus,
                            color: getStatusColor(session.status)
                          }}>
                            {session.status.toUpperCase()}
                          </span>
                        </div>
                        <div style={styles.sessionDetails}>
                          <p>Tables: {session.tableNames.join(', ')}</p>
                          <p>Started: {new Date(session.startTime).toLocaleString()}</p>
                          {session.endTime && (
                            <p>Completed: {new Date(session.endTime).toLocaleString()}</p>
                          )}
                          {session.results && (
                            <p>
                              Results: {Object.values(session.results).filter((r: any) => r.success).length}/{Object.values(session.results).length} successful
                            </p>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const getStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'completed':
      return '#22c55e';
    case 'partial_failed':
    case 'partial-failed':
      return '#f59e0b'; // Orange for partial failures
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

const styles = {
  container: {
    backgroundColor: '#f8fafc',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
  },
  
  // Page header styles
  pageHeader: {
    marginBottom: '32px',
  },
  
  pageTitle: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#1f2937',
    margin: '0 0 8px 0',
  },
  
  pageDescription: {
    fontSize: '16px',
    color: '#6b7280',
    margin: 0,
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
    padding: '16px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    margin: 0,
    color: '#111827',
    fontSize: '24px',
    fontWeight: '600',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  userEmail: {
    color: '#6b7280',
    fontSize: '14px',
  },
  logoutButton: {
    padding: '8px 16px',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
  content: {
    padding: '24px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  setupCard: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '32px',
    textAlign: 'center' as const,
    border: '1px solid #e5e7eb',
  },
  
  setupIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  
  setupTitle: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '8px',
  },
  
  setupDescription: {
    fontSize: '16px',
    color: '#6b7280',
    marginBottom: '24px',
    lineHeight: '1.5',
  },
  
  // Stats grid styles
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
    marginBottom: '32px',
  },
  
  statCard: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '20px',
    border: '1px solid #e5e7eb',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  
  statIcon: {
    fontSize: '32px',
  },
  
  statContent: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  
  statValue: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#1f2937',
    lineHeight: '1',
  },
  
  statLabel: {
    fontSize: '14px',
    color: '#6b7280',
    marginTop: '4px',
  },
  
  // Card icon styles
  cardIcon: {
    fontSize: '32px',
    marginBottom: '12px',
  },
  
  cardTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '8px',
  },
  
  cardDescription: {
    fontSize: '14px',
    color: '#6b7280',
    lineHeight: '1.5',
    marginBottom: '16px',
  },
  mainContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '32px',
  },
  actionCards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '24px',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '24px',
    border: '1px solid #e5e7eb',
  },
  primaryButton: {
    display: 'inline-block',
    padding: '12px 24px',
    backgroundColor: '#3b82f6',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '6px',
    fontWeight: '500',
    marginTop: '16px',
  },
  secondaryButton: {
    display: 'inline-block',
    padding: '12px 24px',
    backgroundColor: '#6b7280',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '6px',
    fontWeight: '500',
    marginTop: '16px',
  },
  sessionsSection: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '24px',
    border: '1px solid #e5e7eb',
  },
  noSessions: {
    color: '#6b7280',
    textAlign: 'center' as const,
    padding: '32px',
  },
  sessionsList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  },
  sessionLink: {
    textDecoration: 'none',
    color: 'inherit',
    display: 'block',
    transition: 'transform 0.2s ease',
    ':hover': {
      transform: 'translateY(-2px)',
    },
  },
  sessionCard: {
    padding: '16px',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    backgroundColor: '#f9fafb',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  sessionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  sessionId: {
    fontWeight: '500',
    color: '#374151',
  },
  sessionStatus: {
    fontSize: '12px',
    fontWeight: '600',
    padding: '4px 8px',
    borderRadius: '4px',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  sessionDetails: {
    fontSize: '14px',
    color: '#6b7280',
  },
};

export default Dashboard;