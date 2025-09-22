import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { settingsAPI, importAPI } from '../services/api';
import { ImportSession } from '../types';

const Dashboard: React.FC = () => {
  const [sessions, setSessions] = useState<ImportSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasSettings, setHasSettings] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
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
      <header style={styles.header}>
        <h1 style={styles.title}>Airtable Import Dashboard</h1>
        <div style={styles.headerActions}>
          <span style={styles.userEmail}>Welcome, {user?.email}</span>
          <button onClick={handleLogout} style={styles.logoutButton}>
            Logout
          </button>
        </div>
      </header>

      <div style={styles.content}>
        {!hasSettings ? (
          <div style={styles.setupCard}>
            <h2>Get Started</h2>
            <p>Before you can start importing from Airtable, you need to configure your settings.</p>
            <Link to="/settings" style={styles.primaryButton}>
              Configure Settings
            </Link>
          </div>
        ) : (
          <div style={styles.mainContent}>
            <div style={styles.actionCards}>
              <div style={styles.card}>
                <h3>Start New Import</h3>
                <p>Import tables from your Airtable base to PostgreSQL database.</p>
                <Link to="/import" style={styles.primaryButton}>
                  Start Import
                </Link>
              </div>
              
              <div style={styles.card}>
                <h3>Settings</h3>
                <p>Manage your Airtable and database connection settings.</p>
                <Link to="/settings" style={styles.secondaryButton}>
                  View Settings
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
                    <div key={session.sessionId} style={styles.sessionCard}>
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
                            Results: {session.results.filter(r => r.success).length}/{session.results.length} successful
                          </p>
                        )}
                      </div>
                    </div>
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
  switch (status) {
    case 'completed':
      return '#22c55e';
    case 'error':
      return '#ef4444';
    case 'running':
      return '#3b82f6';
    default:
      return '#6b7280';
  }
};

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f8fafc',
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
  sessionCard: {
    padding: '16px',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    backgroundColor: '#f9fafb',
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