/**
 * AdminSettings component provides tabbed settings management for the admin dashboard.
 * Features tabs for Import Settings, Import Status, and Import Sessions.
 * Reorganizes the existing settings functionality into a cleaner admin interface.
 */
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { settingsAPI, importAPI } from '../../../services/api';
import { ImportSession } from '../../../types';

/**
 * Settings data interface matching the backend API structure.
 */
interface Settings {
  airtableApiKey: string;
  airtableBaseId: string;
  databaseUrl: string;
  databaseUrlStatus?: 'configured' | 'default';
}

/**
 * Tab configuration interface for settings navigation.
 */
interface Tab {
  id: string;
  label: string;
  path: string;
  icon: string;
}

/**
 * AdminSettings component with tabbed interface for settings management.
 * Provides Import Settings, Import Status, and Import Sessions functionality.
 * 
 * @returns JSX element representing the admin settings interface
 */
const AdminSettings: React.FC = () => {
  // State management for settings, sessions, and UI
  const [settings, setSettings] = useState<Settings>({
    airtableApiKey: '',
    airtableBaseId: '',
    databaseUrl: '',
    databaseUrlStatus: 'default'
  });
  const [sessions, setSessions] = useState<ImportSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('import');
  const [editing, setEditing] = useState({
    airtableApiKey: false,
    airtableBaseId: false,
    databaseUrl: false
  });
  const [tempValues, setTempValues] = useState<Partial<Settings>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // Navigation hooks
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  /**
   * Tab configuration for Settings section navigation.
   */
  const tabs: Tab[] = [
    { id: 'import', label: 'Import Settings', path: '/admin/settings/import', icon: '⚙️' },
    { id: 'status', label: 'Import Status', path: '/admin/settings/status', icon: '📊' },
    { id: 'sessions', label: 'Import Sessions', path: '/admin/settings/sessions', icon: '📋' }
  ];

  /**
   * Loads settings and import sessions data from the API.
   */
  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Load settings
      const settingsData = await settingsAPI.get();
      setSettings({
        airtableApiKey: settingsData.airtableApiKey || '',
        airtableBaseId: settingsData.airtableBaseId || '',
        databaseUrl: settingsData.databaseUrl || '',
        databaseUrlStatus: settingsData.databaseUrlStatus || 'default'
      });

      // Load import sessions
      try {
        const sessionsData = await importAPI.getSessions();
        setSessions(sessionsData);
      } catch (error) {
        // It's okay if there are no sessions yet
        setSessions([]);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to load settings data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Determines active tab based on current route path.
   */
  useEffect(() => {
    const path = location.pathname;
    if (path.includes('/status')) {
      setActiveTab('status');
    } else if (path.includes('/sessions')) {
      setActiveTab('sessions');
    } else {
      setActiveTab('import');
    }
  }, [location.pathname]);

  /**
   * Loads data when component mounts.
   */
  useEffect(() => {
    loadData();
  }, []);

  /**
   * Handles tab navigation clicks.
   */
  const handleTabClick = (tab: Tab) => {
    setActiveTab(tab.id);
    navigate(tab.path);
  };

  /**
   * Starts inline editing for a settings field.
   */
  const handleStartEdit = (field: keyof typeof editing) => {
    setEditing(prev => ({ ...prev, [field]: true }));
    setTempValues(prev => ({ ...prev, [field]: settings[field] }));
    setError('');
    setSuccess('');
  };

  /**
   * Cancels inline editing and reverts changes.
   */
  const handleCancelEdit = (field: keyof typeof editing) => {
    setEditing(prev => ({ ...prev, [field]: false }));
    setTempValues(prev => {
      const newValues = { ...prev };
      delete newValues[field];
      return newValues;
    });
  };

  /**
   * Updates temporary value while editing.
   */
  const handleTempValueChange = (field: keyof typeof editing, value: string) => {
    setTempValues(prev => ({ ...prev, [field]: value }));
  };

  /**
   * Saves field changes to the backend.
   */
  const handleSaveField = async (field: keyof typeof editing) => {
    try {
      setSaving(field);
      setError('');
      setSuccess('');

      const newValue = tempValues[field];
      if (newValue === undefined) {
        throw new Error('No changes to save');
      }

      await settingsAPI.save({ [field]: newValue });
      setSettings(prev => ({ ...prev, [field]: newValue }));
      
      setEditing(prev => ({ ...prev, [field]: false }));
      setTempValues(prev => {
        const newValues = { ...prev };
        delete newValues[field];
        return newValues;
      });

      setTestResults(null);
      setSuccess(`${field} updated successfully`);
      
    } catch (err) {
      console.error(`Failed to save ${field}:`, err);
      setError(`Failed to save ${field}. Please try again.`);
    } finally {
      setSaving(null);
    }
  };

  /**
   * Tests connections using saved settings.
   */
  const handleTestConnections = async () => {
    try {
      setTesting(true);
      setError('');
      setSuccess('');
      
      const result = await settingsAPI.testSavedConnections();
      setTestResults(result);
      
      if (result.airtable?.success && result.database?.success) {
        setSuccess('All connections tested successfully!');
      } else {
        setError('Some connections failed. Check the results below.');
      }
    } catch (err: any) {
      console.error('Connection test failed:', err);
      const errorMessage = err.response?.data?.error || 'Connection test failed. Please check your settings.';
      setError(errorMessage);
      setTestResults(null);
    } finally {
      setTesting(false);
    }
  };

  /**
   * Renders a settings field with inline editing.
   */
  const renderField = (
    field: keyof typeof editing, 
    label: string, 
    type: 'text' | 'password' = 'text',
    placeholder?: string
  ) => {
    const isEditing = editing[field];
    const isSaving = saving === field;
    const currentValue = isEditing ? (tempValues[field] || '') : settings[field];
    
    const isConfigured = field === 'databaseUrl' 
      ? settings.databaseUrlStatus === 'configured'
      : !!(settings[field] && settings[field].trim());

    const displayValue = isEditing ? (tempValues[field] || '') : 
                        (type === 'password' && currentValue ? '••••••••' : currentValue);

    return (
      <div style={styles.fieldContainer}>
        <div style={styles.fieldHeader}>
          <label style={styles.fieldLabel}>{label}</label>
          <div style={styles.statusContainer}>
            {isConfigured ? (
              <span style={styles.statusConfigured}>***CONFIGURED***</span>
            ) : (
              <span style={styles.statusDefault}>***DEFAULT***</span>
            )}
          </div>
        </div>
        
        <div style={styles.fieldInputContainer}>
          <input
            type={type}
            value={displayValue}
            onChange={(e) => isEditing && handleTempValueChange(field, e.target.value)}
            placeholder={placeholder}
            disabled={!isEditing}
            style={{
              ...styles.fieldInput,
              backgroundColor: isEditing ? '#ffffff' : '#f9fafb'
            }}
          />
          
          <div style={styles.fieldActions}>
            {isEditing ? (
              <>
                <button
                  style={styles.primaryButton}
                  onClick={() => handleSaveField(field)}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
                <button
                  style={styles.secondaryButton}
                  onClick={() => handleCancelEdit(field)}
                  disabled={isSaving}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                style={styles.secondaryButton}
                onClick={() => handleStartEdit(field)}
              >
                Edit
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  /**
   * Renders the Import Settings tab content.
   */
  const renderImportSettingsTab = () => (
    <div style={styles.tabContent}>
      <div style={styles.tabHeader}>
        <div>
          <h3 style={styles.tabTitle}>Import Configuration</h3>
          <p style={styles.tabDescription}>Configure Airtable and database connections for data import</p>
        </div>
      </div>

      {/* Settings Fields */}
      <div style={styles.settingsForm}>
        {renderField('airtableApiKey', 'Airtable API Key', 'password', 'Enter your Airtable API key')}
        {renderField('airtableBaseId', 'Airtable Base ID', 'text', 'Enter your Airtable base ID')}
        {renderField('databaseUrl', 'Database URL', 'password', 'Enter your database connection URL')}
      </div>

      {/* Connection Testing */}
      <div style={styles.testSection}>
        <button
          style={styles.primaryButton}
          onClick={handleTestConnections}
          disabled={testing}
        >
          {testing ? 'Testing Connections...' : 'Test Connections'}
        </button>

        {/* Test Results */}
        {testResults && (
          <div style={styles.testResults}>
            <h4 style={styles.testResultsTitle}>Connection Test Results</h4>
            
            <div style={styles.testResultItem}>
              <div style={styles.testResultLabel}>Airtable Connection</div>
              <div style={{
                ...styles.testResultStatus,
                color: testResults.airtable?.success ? '#065f46' : '#991b1b'
              }}>
                {testResults.airtable?.success ? '✅ Success' : '❌ Failed'}
              </div>
              <div style={styles.testResultMessage}>
                {testResults.airtable?.message || 'No additional details'}
              </div>
            </div>

            <div style={styles.testResultItem}>
              <div style={styles.testResultLabel}>Database Connection</div>
              <div style={{
                ...styles.testResultStatus,
                color: testResults.database?.success ? '#065f46' : '#991b1b'
              }}>
                {testResults.database?.success ? '✅ Success' : '❌ Failed'}
              </div>
              <div style={styles.testResultMessage}>
                {testResults.database?.message || 'No additional details'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  /**
   * Renders the Import Status tab content.
   */
  const renderImportStatusTab = () => (
    <div style={styles.tabContent}>
      <div style={styles.tabHeader}>
        <div>
          <h3 style={styles.tabTitle}>System Status</h3>
          <p style={styles.tabDescription}>Monitor the health and status of your import system</p>
        </div>
      </div>

      <div style={styles.statusGrid}>
        {/* Connection Status Cards */}
        <div style={styles.statusCard}>
          <div style={styles.statusCardHeader}>
            <h4 style={styles.statusCardTitle}>Airtable Connection</h4>
            <span style={settings.airtableApiKey && settings.airtableBaseId ? styles.statusOnline : styles.statusOffline}>
              {settings.airtableApiKey && settings.airtableBaseId ? 'CONFIGURED' : 'NOT CONFIGURED'}
            </span>
          </div>
          <p style={styles.statusCardDescription}>
            {settings.airtableApiKey && settings.airtableBaseId 
              ? 'Airtable API credentials are configured and ready for use.'
              : 'Airtable API credentials need to be configured in Import Settings.'}
          </p>
        </div>

        <div style={styles.statusCard}>
          <div style={styles.statusCardHeader}>
            <h4 style={styles.statusCardTitle}>Database Connection</h4>
            <span style={settings.databaseUrlStatus === 'configured' ? styles.statusOnline : styles.statusOffline}>
              {settings.databaseUrlStatus === 'configured' ? 'CONFIGURED' : 'DEFAULT'}
            </span>
          </div>
          <p style={styles.statusCardDescription}>
            {settings.databaseUrlStatus === 'configured'
              ? 'Custom database URL is configured and active.'
              : 'Using default database configuration.'}
          </p>
        </div>

        <div style={styles.statusCard}>
          <div style={styles.statusCardHeader}>
            <h4 style={styles.statusCardTitle}>Recent Activity</h4>
            <span style={styles.statusInfo}>
              {sessions.length} SESSIONS
            </span>
          </div>
          <p style={styles.statusCardDescription}>
            {sessions.length > 0 
              ? `${sessions.length} import sessions have been recorded.`
              : 'No import sessions found. Start an import to see activity.'}
          </p>
        </div>
      </div>
    </div>
  );

  /**
   * Renders the Import Sessions tab content.
   */
  const renderImportSessionsTab = () => (
    <div style={styles.tabContent}>
      <div style={styles.tabHeader}>
        <div>
          <h3 style={styles.tabTitle}>Import Sessions</h3>
          <p style={styles.tabDescription}>View and manage your data import history</p>
        </div>
        <button
          style={styles.primaryButton}
          onClick={() => navigate('/admin/import')}
        >
          Start New Import
        </button>
      </div>

      {sessions.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyStateIcon}>📋</div>
          <h4 style={styles.emptyStateTitle}>No Import Sessions</h4>
          <p style={styles.emptyStateDescription}>
            You haven't run any imports yet. Start your first import to see session history here.
          </p>
          <button
            style={styles.primaryButton}
            onClick={() => navigate('/admin/import')}
          >
            Start First Import
          </button>
        </div>
      ) : (
        <div style={styles.sessionsTable}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeader}>
                <th style={styles.tableHeaderCell}>Session ID</th>
                <th style={styles.tableHeaderCell}>Status</th>
                <th style={styles.tableHeaderCell}>Tables</th>
                <th style={styles.tableHeaderCell}>Records</th>
                <th style={styles.tableHeaderCell}>Started</th>
                <th style={styles.tableHeaderCell}>Duration</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(session => {
                const duration = session.endTime 
                  ? Math.round((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 1000)
                  : null;

                return (
                  <tr key={session.sessionId} style={styles.tableRow}>
                    <td style={styles.tableCell}>
                      <code style={styles.sessionId}>{session.sessionId.slice(-8)}</code>
                    </td>
                    <td style={styles.tableCell}>
                      <span style={{
                        ...styles.statusBadge,
                        ...(session.status === 'completed' ? styles.statusSuccess : 
                            session.status === 'error' ? styles.statusError : styles.statusWarning)
                      }}>
                        {session.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={styles.tableCell}>
                      {session.tableNames?.join(', ') || 'N/A'}
                    </td>
                    <td style={styles.tableCell}>
                      {session.results ? Object.values(session.results).reduce((total: number, result: any) => 
                        total + (result.processedRecords || result.recordsImported || 0), 0) : 0}
                    </td>
                    <td style={styles.tableCell}>
                      {new Date(session.startTime).toLocaleString()}
                    </td>
                    <td style={styles.tableCell}>
                      {duration ? `${duration}s` : 'N/A'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner}></div>
        <p>Loading settings...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Page Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>System Settings</h1>
        <p style={styles.description}>
          Configure and monitor your Airtable Import system
        </p>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div style={styles.errorMessage}>
          {error}
        </div>
      )}
      {success && (
        <div style={styles.successMessage}>
          {success}
        </div>
      )}

      {/* Tab Navigation */}
      <div style={styles.tabNavigation}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.tabActive : {})
            }}
            onClick={() => handleTabClick(tab)}
          >
            <span style={styles.tabIcon}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'import' && renderImportSettingsTab()}
      {activeTab === 'status' && renderImportStatusTab()}
      {activeTab === 'sessions' && renderImportSessionsTab()}
    </div>
  );
};

// Comprehensive styles for the AdminSettings component
const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto'
  },

  header: {
    marginBottom: '32px'
  },

  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#1f2937',
    margin: '0 0 8px 0'
  },

  description: {
    fontSize: '16px',
    color: '#6b7280',
    margin: 0
  },

  // Messages
  errorMessage: {
    padding: '12px 16px',
    backgroundColor: '#fef2f2',
    color: '#991b1b',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    marginBottom: '24px'
  },

  successMessage: {
    padding: '12px 16px',
    backgroundColor: '#f0fdf4',
    color: '#166534',
    border: '1px solid #bbf7d0',
    borderRadius: '6px',
    marginBottom: '24px'
  },

  // Tab navigation
  tabNavigation: {
    display: 'flex',
    borderBottom: '2px solid #e5e7eb',
    marginBottom: '32px',
    gap: '4px'
  },

  tab: {
    padding: '12px 24px',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    color: '#6b7280',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.2s ease'
  },

  tabActive: {
    color: '#3b82f6',
    borderBottomColor: '#3b82f6'
  },

  tabIcon: {
    fontSize: '16px'
  },

  // Tab content
  tabContent: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    padding: '24px',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
  },

  tabHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px'
  },

  tabTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#1f2937',
    margin: '0 0 4px 0'
  },

  tabDescription: {
    fontSize: '14px',
    color: '#6b7280',
    margin: 0
  },

  // Settings form
  settingsForm: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
    marginBottom: '32px'
  },

  fieldContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px'
  },

  fieldHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },

  fieldLabel: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151'
  },

  statusContainer: {
    marginLeft: '16px'
  },

  statusConfigured: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#065f46',
    backgroundColor: '#f0fdf4',
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid #bbf7d0'
  },

  statusDefault: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#92400e',
    backgroundColor: '#fffbeb',
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid #fed7aa'
  },

  fieldInputContainer: {
    display: 'flex',
    gap: '16px',
    alignItems: 'flex-start'
  },

  fieldInput: {
    flex: 1,
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    transition: 'border-color 0.2s ease',
    ':focus': {
      outline: 'none',
      borderColor: '#3b82f6',
      boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)'
    }
  },

  fieldActions: {
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-start'
  },

  // Buttons
  primaryButton: {
    padding: '10px 20px',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'background-color 0.2s ease'
  },

  secondaryButton: {
    padding: '10px 20px',
    backgroundColor: '#f3f4f6',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },

  // Test section
  testSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
    paddingTop: '24px',
    borderTop: '1px solid #e5e7eb'
  },

  testResults: {
    backgroundColor: '#f9fafb',
    padding: '16px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb'
  },

  testResultsTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '16px'
  },

  testResultItem: {
    marginBottom: '16px',
    paddingBottom: '16px',
    borderBottom: '1px solid #e5e7eb'
  },

  testResultLabel: {
    fontSize: '14px',
    fontWeight: '600',
    marginBottom: '4px'
  },

  testResultStatus: {
    fontSize: '14px',
    fontWeight: '500',
    marginBottom: '4px'
  },

  testResultMessage: {
    fontSize: '13px',
    color: '#6b7280'
  },

  // Status grid
  statusGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '20px'
  },

  statusCard: {
    padding: '20px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    backgroundColor: '#ffffff'
  },

  statusCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },

  statusCardTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1f2937',
    margin: 0
  },

  statusOnline: {
    padding: '4px 8px',
    backgroundColor: '#d1fae5',
    color: '#065f46',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: '600'
  },

  statusOffline: {
    padding: '4px 8px',
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: '600'
  },

  statusInfo: {
    padding: '4px 8px',
    backgroundColor: '#e0e7ff',
    color: '#3730a3',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: '600'
  },

  statusCardDescription: {
    fontSize: '14px',
    color: '#6b7280',
    lineHeight: '1.5'
  },

  // Empty state
  emptyState: {
    textAlign: 'center' as const,
    padding: '48px 24px'
  },

  emptyStateIcon: {
    fontSize: '48px',
    marginBottom: '16px'
  },

  emptyStateTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '8px'
  },

  emptyStateDescription: {
    fontSize: '14px',
    color: '#6b7280',
    marginBottom: '24px',
    lineHeight: '1.5'
  },

  // Sessions table
  sessionsTable: {
    overflowX: 'auto' as const
  },

  table: {
    width: '100%',
    borderCollapse: 'collapse' as const
  },

  tableHeader: {
    backgroundColor: '#f9fafb'
  },

  tableHeaderCell: {
    padding: '12px',
    textAlign: 'left' as const,
    fontSize: '12px',
    fontWeight: '600',
    color: '#374151',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px'
  },

  tableRow: {
    borderBottom: '1px solid #e5e7eb'
  },

  tableCell: {
    padding: '12px',
    fontSize: '14px',
    color: '#1f2937'
  },

  sessionId: {
    fontFamily: 'monospace',
    fontSize: '12px',
    backgroundColor: '#f3f4f6',
    padding: '2px 4px',
    borderRadius: '4px'
  },

  statusBadge: {
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: '500',
    textTransform: 'uppercase' as const
  },

  statusSuccess: {
    backgroundColor: '#d1fae5',
    color: '#065f46'
  },

  statusError: {
    backgroundColor: '#fee2e2',
    color: '#991b1b'
  },

  statusWarning: {
    backgroundColor: '#fef3c7',
    color: '#92400e'
  },

  // Loading state
  loading: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '400px',
    gap: '16px'
  },

  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #e5e7eb',
    borderTop: '3px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  }
};

export default AdminSettings;