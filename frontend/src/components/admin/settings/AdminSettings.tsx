import React from 'react';

/**
 * AdminSettings component displays read-only system configuration status.
 * All settings are now managed via environment variables (.env file).
 * This component shows configuration status without allowing edits.
 */
const AdminSettings: React.FC = () => {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>System Configuration</h1>
        <p style={styles.subtitle}>
          Configuration is managed via environment variables
        </p>
      </div>

      <div style={styles.content}>
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Environment Configuration</h3>
          <p style={styles.cardDescription}>
            All system settings are configured through environment variables in the .env file.
            Contact your system administrator to modify Airtable API keys, database connections, or other settings.
          </p>
          
          <div style={styles.configSection}>
            <h4 style={styles.sectionTitle}>Required Environment Variables:</h4>
            <ul style={styles.configList}>
              <li><code style={styles.envVar}>AIRTABLE_API_KEY</code> - Your Airtable API key for data access</li>
              <li><code style={styles.envVar}>AIRTABLE_BASE_ID</code> - Your Airtable base ID for imports</li>
              <li><code style={styles.envVar}>DATABASE_URL</code> - PostgreSQL connection string for data storage</li>
            </ul>
          </div>

          <div style={styles.configSection}>
            <h4 style={styles.sectionTitle}>How to Update Configuration:</h4>
            <ol style={styles.stepsList}>
              <li>Edit the <code style={styles.envVar}>.env</code> file in the project root</li>
              <li>Update the required environment variables</li>
              <li>Restart the backend server to apply changes</li>
            </ol>
          </div>

          <div style={styles.noteSection}>
            <p style={styles.noteText}>
              ℹ️ <strong>Note:</strong> Settings are no longer stored in the database. 
              All configuration is environment-based for better security and deployment practices.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '24px',
    backgroundColor: '#f8fafc',
    minHeight: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
  },

  header: {
    marginBottom: '32px',
    textAlign: 'center' as const,
  },

  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#1f2937',
    margin: '0 0 8px 0',
  },

  subtitle: {
    fontSize: '16px',
    color: '#6b7280',
    margin: 0,
  },

  content: {
    display: 'flex',
    justifyContent: 'center',
  },

  card: {
    backgroundColor: '#ffffff',
    padding: '32px',
    borderRadius: '12px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    maxWidth: '800px',
    width: '100%',
  },

  cardTitle: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '16px',
  },

  cardDescription: {
    fontSize: '16px',
    color: '#6b7280',
    lineHeight: '1.6',
    marginBottom: '32px',
  },

  configSection: {
    marginBottom: '32px',
  },

  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '12px',
  },

  configList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },

  stepsList: {
    paddingLeft: '20px',
    margin: 0,
  },

  envVar: {
    backgroundColor: '#f3f4f6',
    color: '#1f2937',
    padding: '2px 6px',
    borderRadius: '4px',
    fontFamily: 'Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
    fontSize: '14px',
  },

  noteSection: {
    backgroundColor: '#eff6ff',
    padding: '16px',
    borderRadius: '8px',
    borderLeft: '4px solid #3b82f6',
  },

  noteText: {
    margin: 0,
    color: '#1e40af',
    fontSize: '14px',
    lineHeight: '1.5',
  },
};

export default AdminSettings;
