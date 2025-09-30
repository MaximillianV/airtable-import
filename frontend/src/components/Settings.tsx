import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const Settings: React.FC = () => {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Settings</h1>
        <p style={styles.subtitle}>
          System configuration is managed via environment variables
        </p>
      </div>

      <div style={styles.navigation}>
        <button 
          style={styles.navButton}
          onClick={() => window.location.href = '/dashboard'}
        >
          ← Back to Dashboard
        </button>
        <button 
          style={styles.logoutButton}
          onClick={handleLogout}
        >
          Logout ({user?.email})
        </button>
      </div>

      <div style={styles.statusContainer}>
        <div style={styles.statusCard}>
          <h3 style={styles.cardTitle}>Configuration Information</h3>
          <p style={styles.cardDescription}>
            All system settings are configured through environment variables.
            Contact your system administrator to modify Airtable API keys, database connections, or other settings.
          </p>
          
          <div style={styles.infoSection}>
            <h4>Environment Variables Required:</h4>
            <ul style={styles.configList}>
              <li><code>AIRTABLE_API_KEY</code> - Your Airtable API key</li>
              <li><code>AIRTABLE_BASE_ID</code> - Your Airtable base ID</li>
              <li><code>DATABASE_URL</code> - PostgreSQL connection string</li>
            </ul>
          </div>

          <div style={styles.infoSection}>
            <p style={styles.noteText}>
              <strong>Note:</strong> Import functionality requires all environment variables to be properly configured.
              If you see "Settings Required" errors, verify these environment variables are set in your .env file.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f8fafc',
    padding: '24px'
  } as React.CSSProperties,

  header: {
    marginBottom: '32px'
  } as React.CSSProperties,

  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#1f2937',
    margin: '0 0 8px 0'
  } as React.CSSProperties,

  subtitle: {
    fontSize: '16px',
    color: '#6b7280',
    margin: '0'
  } as React.CSSProperties,

  navigation: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '32px'
  } as React.CSSProperties,

  navButton: {
    padding: '8px 16px',
    backgroundColor: '#ffffff',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    color: '#374151',
    cursor: 'pointer',
    fontSize: '14px'
  } as React.CSSProperties,

  logoutButton: {
    padding: '8px 16px',
    backgroundColor: '#ef4444',
    border: 'none',
    borderRadius: '6px',
    color: 'white',
    cursor: 'pointer',
    fontSize: '14px'
  } as React.CSSProperties,

  statusContainer: {
    maxWidth: '800px',
    margin: '0 auto'
  } as React.CSSProperties,

  statusCard: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
  } as React.CSSProperties,

  cardTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#1f2937',
    margin: '0 0 8px 0'
  } as React.CSSProperties,

  cardDescription: {
    fontSize: '14px',
    color: '#6b7280',
    margin: '0 0 24px 0',
    lineHeight: '1.5'
  } as React.CSSProperties,

  infoSection: {
    marginBottom: '24px'
  } as React.CSSProperties,

  configList: {
    margin: '8px 0',
    paddingLeft: '20px',
    color: '#374151'
  } as React.CSSProperties,

  noteText: {
    fontSize: '14px',
    color: '#374151',
    backgroundColor: '#f0f9ff',
    padding: '12px',
    borderRadius: '6px',
    border: '1px solid #0ea5e9'
  } as React.CSSProperties
};

export default Settings;
