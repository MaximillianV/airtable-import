import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { settingsAPI } from '../services/api';
import { Layout } from './ui/Layout';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { theme } from '../theme';

/**
 * Interface defining the structure of application settings.
 * Matches the backend API response structure for settings data.
 */
interface Settings {
  airtableApiKey: string;
  airtableBaseId: string;
  databaseUrl: string;
  databaseUrlStatus?: 'configured' | 'default';
  debugMode?: boolean;
}

/**
 * Settings component provides a modern admin interface for configuring application settings.
 * Features inline editing, connection testing, and database reset functionality.
 * Uses the new design system components for consistent styling and user experience.
 */
const Settings: React.FC = () => {
  // Authentication context for user management
  const { user } = useAuth();

  // Main settings state with default values
  const [settings, setSettings] = useState<Settings>({
    airtableApiKey: '',
    airtableBaseId: '',
    databaseUrl: '',
    databaseUrlStatus: 'default',
    debugMode: false
  });

  // State management for inline editing functionality
  const [editing, setEditing] = useState({
    airtableApiKey: false,
    airtableBaseId: false,
    databaseUrl: false
  });

  // Temporary values for fields being edited (before save/cancel)
  const [tempValues, setTempValues] = useState<Partial<Settings>>({});

  // Loading states for various operations
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Connection test results and user feedback
  const [testResults, setTestResults] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  /**
   * Loads current settings from the API on component mount.
   * Updates component state with loaded values and handles loading states.
   */
  useEffect(() => {
    loadSettings();
  }, []);

  /**
   * Fetches current settings from the backend API.
   * Handles partial responses and sets appropriate default values.
   */
  const loadSettings = async () => {
    try {
      setLoading(true);
      setError('');
      
      const data = await settingsAPI.get();
      console.log('Settings API response:', data);
      console.log('Debug mode from API:', data.debugMode);
      
      // Set values with defaults for any missing fields
      setSettings({
        airtableApiKey: data.airtableApiKey || '',
        airtableBaseId: data.airtableBaseId || '',
        databaseUrl: data.databaseUrl || '',
        databaseUrlStatus: data.databaseUrlStatus || 'default',
        debugMode: data.debugMode || false
      });
      
      console.log('Settings state set with debugMode:', data.debugMode || false);
    } catch (err) {
      console.error('Failed to load settings:', err);
      setError('Failed to load settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Initiates inline editing for a specific field.
   * Sets up temporary editing state and stores current value for potential cancellation.
   */
  const handleStartEdit = (field: keyof typeof editing) => {
    setEditing(prev => ({ ...prev, [field]: true }));
    setTempValues(prev => ({ ...prev, [field]: settings[field] }));
    setError('');
    setSuccess('');
  };

  /**
   * Cancels inline editing for a field and reverts to original value.
   * Clears temporary editing state without saving changes.
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
   * Updates temporary value while editing a field.
   * Allows real-time preview of changes before saving.
   */
  const handleTempValueChange = (field: keyof typeof editing, value: string) => {
    setTempValues(prev => ({ ...prev, [field]: value }));
  };

  /**
   * Saves changes for a specific field to the backend.
   * Handles validation, API calls, and updates the main settings state.
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

      // Save to backend with partial update
      await settingsAPI.save({ [field]: newValue });

      // Update local state with saved value
      setSettings(prev => ({ ...prev, [field]: newValue }));
      
      // Clear editing state
      setEditing(prev => ({ ...prev, [field]: false }));
      setTempValues(prev => {
        const newValues = { ...prev };
        delete newValues[field];
        return newValues;
      });

      // Clear test results since settings changed
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
   * Tests connections using the saved settings from the database.
   * Uses the new API endpoint that retrieves actual saved values server-side.
   * Provides feedback about connection success or failure.
   */
  const handleTestConnections = async () => {
    try {
      setTesting(true);
      setError('');
      setSuccess('');
      
      // Use the new API method that tests connections with actual saved settings
      // This bypasses the issue of masked display values in the frontend
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
   * Resets database settings to default values.
   * Uses the existing settings save API to clear database URL.
   */
  const handleResetDatabase = async () => {
    if (!window.confirm('Are you sure you want to reset database settings to default? This action cannot be undone.')) {
      return;
    }

    try {
      setResetting(true);
      setError('');
      setSuccess('');

      // Reset database URL to empty (which will use default)
      await settingsAPI.save({ databaseUrl: '' });
      
      // Reload settings to get updated values
      await loadSettings();
      
      // Clear test results
      setTestResults(null);
      setSuccess('Database settings have been reset to default values.');
    } catch (err) {
      console.error('Failed to reset database:', err);
      setError('Failed to reset database settings. Please try again.');
    } finally {
      setResetting(false);
    }
  };

  /**
   * Handles debug mode toggle changes.
   * Immediately saves the debug mode setting to the server.
   */
  const handleDebugModeChange = async (enabled: boolean) => {
    try {
      setError('');
      setSuccess('');

      // Update local state immediately for responsive UI
      setSettings(prev => ({
        ...prev,
        debugMode: enabled
      }));

      // Save to server
      await settingsAPI.save({ debugMode: enabled });
      
      setSuccess(`Debug mode ${enabled ? 'enabled' : 'disabled'} successfully`);
    } catch (err) {
      console.error('Failed to update debug mode:', err);
      
      // Revert local state on error
      setSettings(prev => ({
        ...prev,
        debugMode: !enabled
      }));
      
      setError('Failed to update debug mode. Please try again.');
    }
  };

  /**
   * Renders an individual settings field with inline editing capability.
   * Includes Edit/Save/Cancel buttons, loading states, and status indicators.
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
    
    // Determine if field is configured
    const isConfigured = field === 'databaseUrl' 
      ? settings.databaseUrlStatus === 'configured'
      : !!(settings[field] && settings[field].trim());

    // Display value (masked for passwords if not editing)
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
          <Input
            type={type}
            value={displayValue}
            onChange={(e) => isEditing && handleTempValueChange(field, e.target.value)}
            placeholder={placeholder}
            disabled={!isEditing}
            style={{
              ...styles.fieldInput,
              backgroundColor: isEditing ? theme.colors.neutral.white : theme.colors.neutral[50]
            }}
          />
          
          <div style={styles.fieldActions}>
            {isEditing ? (
              <>
                <Button
                  variant="primary"
                  size="small"
                  onClick={() => handleSaveField(field)}
                  disabled={isSaving}
                  style={styles.actionButton}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => handleCancelEdit(field)}
                  disabled={isSaving}
                  style={styles.actionButton}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                variant="secondary"
                size="small"
                onClick={() => handleStartEdit(field)}
                style={styles.actionButton}
              >
                Edit
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  /**
   * Renders connection test results with appropriate styling.
   * Shows success/error states with detailed feedback messages.
   */
  const renderTestResults = () => {
    if (!testResults) return null;

    return (
      <div style={styles.testResults}>
        <h4 style={styles.testResultsTitle}>Connection Test Results</h4>
        
        {/* Airtable Results */}
        <div style={styles.testResultItem}>
          <div style={styles.testResultLabel}>Airtable:</div>
          <div style={{
            ...styles.testResultStatus,
            color: testResults.airtable?.success ? theme.colors.semantic.success : theme.colors.semantic.error
          }}>
            {testResults.airtable?.success ? '✓ Success' : '✗ Failed'}
          </div>
          <div style={styles.testResultMessage}>
            {testResults.airtable?.message || 'No message available'}
          </div>
        </div>

        {/* Database Results */}
        <div style={styles.testResultItem}>
          <div style={styles.testResultLabel}>Database:</div>
          <div style={{
            ...styles.testResultStatus,
            color: testResults.database?.success ? theme.colors.semantic.success : theme.colors.semantic.error
          }}>
            {testResults.database?.success ? '✓ Success' : '✗ Failed'}
          </div>
          <div style={styles.testResultMessage}>
            {testResults.database?.message || 'No message available'}
          </div>
        </div>
      </div>
    );
  };

  // Show loading state while fetching initial settings
  if (loading) {
    return (
      <Layout currentPath="/settings">
        <div style={styles.loadingContainer}>
          <div style={styles.loadingText}>Loading settings...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout currentPath="/settings">
      <div style={styles.pageHeader}>
        <h1 style={theme.typography.h1}>Settings</h1>
        <p style={styles.pageSubtitle}>Configure your Airtable and database connections</p>
      </div>
      
      {/* Error/Success Messages */}
      {error && (
        <div style={styles.errorContainer}>
          <div style={styles.errorMessage}>{error}</div>
        </div>
      )}
      
      {success && (
        <div style={styles.successContainer}>
          <div style={styles.successMessage}>{success}</div>
        </div>
      )}

      <div style={styles.settingsContainer}>
        {/* Airtable Configuration Section */}
        <Card style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={theme.typography.h3}>Airtable Configuration</h3>
            <p style={styles.cardSubtitle}>Configure your Airtable API connection settings</p>
          </div>
          
          <div style={styles.cardContent}>
            {renderField('airtableApiKey', 'Airtable API Key', 'password', 'Enter your Airtable API key')}
            {renderField('airtableBaseId', 'Airtable Base ID', 'text', 'Enter your Airtable base ID')}
          </div>
        </Card>

        {/* Database Configuration Section */}
        <Card style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={theme.typography.h3}>Database Configuration</h3>
            <p style={styles.cardSubtitle}>Configure your PostgreSQL database connection</p>
          </div>
          
          <div style={styles.cardContent}>
            {renderField('databaseUrl', 'Database URL', 'password', 'Enter your PostgreSQL connection string')}
            
            <div style={styles.databaseActions}>
              <Button
                variant="danger"
                onClick={handleResetDatabase}
                disabled={resetting}
                style={styles.resetButton}
              >
                {resetting ? 'Resetting...' : 'Reset to Default'}
              </Button>
            </div>
          </div>
        </Card>

        {/* Debug Configuration Section */}
        {(() => {
          console.log('Rendering debug section with settings.debugMode:', settings.debugMode);
          return null;
        })()}
        <Card style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={theme.typography.h3}>Debug Configuration</h3>
            <p style={styles.cardSubtitle}>Enable verbose logging during imports</p>
          </div>
          
          <div style={styles.cardContent}>
            <div style={styles.debugSection}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={settings.debugMode}
                  onChange={(e) => handleDebugModeChange(e.target.checked)}
                  style={styles.checkbox}
                />
                <span style={styles.checkboxText}>
                  Enable Debug Mode
                </span>
              </label>
              <p style={styles.debugDescription}>
                When enabled, detailed logging information will be displayed during imports, 
                including progress details, connection status, and processing steps.
              </p>
            </div>
          </div>
        </Card>

        {/* Connection Testing Section */}
        <Card style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={theme.typography.h3}>Connection Testing</h3>
            <p style={styles.cardSubtitle}>Test your Airtable and database connections</p>
          </div>
          
          <div style={styles.cardContent}>
            <div style={styles.testSection}>
              <Button
                variant="primary"
                onClick={handleTestConnections}
                disabled={testing || !settings.airtableApiKey || !settings.airtableBaseId}
                style={styles.testButton}
              >
                {testing ? 'Testing Connections...' : 'Test All Connections'}
              </Button>
              
              {renderTestResults()}
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
};

/**
 * Styles object following the design system theme.
 * Uses consistent spacing, colors, and typography from the theme object.
 */
const styles = {
  // Page header styles
  pageHeader: {
    marginBottom: theme.spacing.xl
  } as React.CSSProperties,
  
  pageSubtitle: {
    ...theme.typography.bodyLarge,
    color: theme.colors.neutral[600],
    marginTop: theme.spacing.sm
  } as React.CSSProperties,

  // Loading state styles
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '400px'
  } as React.CSSProperties,
  
  loadingText: {
    ...theme.typography.bodyLarge,
    color: theme.colors.neutral[600]
  } as React.CSSProperties,

  // Message containers
  errorContainer: {
    marginBottom: theme.spacing.lg
  } as React.CSSProperties,
  
  errorMessage: {
    padding: theme.spacing.md,
    backgroundColor: '#fef2f2',
    color: theme.colors.semantic.error,
    borderRadius: theme.borderRadius.md,
    border: `1px solid #fecaca`
  } as React.CSSProperties,

  successContainer: {
    marginBottom: theme.spacing.lg
  } as React.CSSProperties,
  
  successMessage: {
    padding: theme.spacing.md,
    backgroundColor: '#f0fdf4',
    color: theme.colors.semantic.success,
    borderRadius: theme.borderRadius.md,
    border: `1px solid #bbf7d0`
  } as React.CSSProperties,

  // Main settings container
  settingsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xl,
    maxWidth: '800px'
  } as React.CSSProperties,

  // Card styling
  card: {
    padding: 0
  } as React.CSSProperties,

  cardHeader: {
    padding: theme.spacing.lg,
    borderBottom: `1px solid ${theme.colors.neutral[200]}`
  } as React.CSSProperties,

  cardSubtitle: {
    ...theme.typography.body,
    color: theme.colors.neutral[600],
    marginTop: theme.spacing.xs
  } as React.CSSProperties,

  cardContent: {
    padding: theme.spacing.lg,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg
  } as React.CSSProperties,

  // Field styling
  fieldContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm
  } as React.CSSProperties,

  fieldHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  } as React.CSSProperties,

  fieldLabel: {
    ...theme.typography.body,
    fontWeight: 500,
    color: theme.colors.neutral[600]
  } as React.CSSProperties,

  statusContainer: {
    marginLeft: theme.spacing.md
  } as React.CSSProperties,

  statusConfigured: {
    fontSize: '11px',
    fontWeight: 600,
    color: theme.colors.semantic.success,
    backgroundColor: '#f0fdf4',
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.sm,
    border: `1px solid #bbf7d0`
  } as React.CSSProperties,

  statusDefault: {
    fontSize: '11px',
    fontWeight: 600,
    color: theme.colors.semantic.warning,
    backgroundColor: '#fffbeb',
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.sm,
    border: `1px solid #fed7aa`
  } as React.CSSProperties,

  fieldInputContainer: {
    display: 'flex',
    gap: theme.spacing.md,
    alignItems: 'flex-start'
  } as React.CSSProperties,

  fieldInput: {
    flex: 1
  } as React.CSSProperties,

  fieldActions: {
    display: 'flex',
    gap: theme.spacing.sm,
    alignItems: 'flex-start'
  } as React.CSSProperties,

  actionButton: {
    minWidth: '80px'
  } as React.CSSProperties,

  // Database actions
  databaseActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    paddingTop: theme.spacing.md,
    borderTop: `1px solid ${theme.colors.neutral[200]}`
  } as React.CSSProperties,

  resetButton: {
    minWidth: '140px'
  } as React.CSSProperties,

  // Test section
  testSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg
  } as React.CSSProperties,

  testButton: {
    alignSelf: 'flex-start',
    minWidth: '180px'
  } as React.CSSProperties,

  // Test results
  testResults: {
    backgroundColor: theme.colors.neutral[50],
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    border: `1px solid ${theme.colors.neutral[200]}`
  } as React.CSSProperties,

  testResultsTitle: {
    ...theme.typography.h3,
    marginBottom: theme.spacing.md
  } as React.CSSProperties,

  testResultItem: {
    marginBottom: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderBottom: `1px solid ${theme.colors.neutral[200]}`
  } as React.CSSProperties,

  testResultLabel: {
    ...theme.typography.body,
    fontWeight: 600,
    marginBottom: theme.spacing.xs
  } as React.CSSProperties,

  testResultStatus: {
    ...theme.typography.body,
    fontWeight: 500,
    marginBottom: theme.spacing.xs
  } as React.CSSProperties,

  testResultMessage: {
    ...theme.typography.small,
    color: theme.colors.neutral[600]
  } as React.CSSProperties,

  // Debug section
  debugSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md
  } as React.CSSProperties,

  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    cursor: 'pointer'
  } as React.CSSProperties,

  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer'
  } as React.CSSProperties,

  checkboxText: {
    ...theme.typography.body,
    fontWeight: 500
  } as React.CSSProperties,

  debugDescription: {
    ...theme.typography.small,
    color: theme.colors.neutral[600],
    lineHeight: 1.5
  } as React.CSSProperties
};

export default Settings;