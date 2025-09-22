import React, { useState, useEffect } from 'react';
import { settingsAPI } from '../services/api';
import { Settings as SettingsType, ConnectionTestResult } from '../types';

interface SettingsProps {
  onSettingsSaved?: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onSettingsSaved }) => {
  const [settings, setSettings] = useState<SettingsType>({
    airtableApiKey: '',
    airtableBaseId: '',
    databaseUrl: '',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [testResults, setTestResults] = useState<ConnectionTestResult | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const savedSettings = await settingsAPI.get();
      setSettings(prev => ({
        ...prev,
        airtableBaseId: savedSettings.airtableBaseId || '',
        // Don't overwrite password fields if they're already configured
        airtableApiKey: savedSettings.airtableApiKey === '***CONFIGURED***' ? '' : (savedSettings.airtableApiKey || ''),
        databaseUrl: savedSettings.databaseUrl === '***CONFIGURED***' ? '' : (savedSettings.databaseUrl || ''),
      }));
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof SettingsType, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    setMessage('');
    setTestResults(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    
    try {
      await settingsAPI.save(settings);
      setMessage('Settings saved successfully!');
      setMessageType('success');
      if (onSettingsSaved) {
        onSettingsSaved();
      }
    } catch (error: any) {
      setMessage(error.response?.data?.error || 'Failed to save settings');
      setMessageType('error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnections = async () => {
    if (!settings.airtableApiKey || !settings.airtableBaseId || !settings.databaseUrl) {
      setMessage('Please fill in all fields before testing connections');
      setMessageType('error');
      return;
    }

    setTesting(true);
    setMessage('');
    setTestResults(null);

    try {
      const results = await settingsAPI.testConnections(settings);
      setTestResults(results);
      
      const allSuccessful = results.airtable.success && results.database.success;
      setMessage(allSuccessful ? 'All connections successful!' : 'Some connections failed');
      setMessageType(allSuccessful ? 'success' : 'error');
    } catch (error: any) {
      setMessage(error.response?.data?.error || 'Failed to test connections');
      setMessageType('error');
    } finally {
      setTesting(false);
    }
  };

  const isFormValid = settings.airtableApiKey && settings.airtableBaseId && settings.databaseUrl;

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Settings</h2>
      <p style={styles.subtitle}>Configure your Airtable and Database connections</p>
      
      {loading ? (
        <div style={styles.loading}>Loading settings...</div>
      ) : (
        <div style={styles.form}>
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Airtable Configuration</h3>
            
            <div style={styles.field}>
              <label style={styles.label}>
                API Key
                <span style={styles.required}>*</span>
              </label>
              <input
                type="password"
                value={settings.airtableApiKey}
                onChange={(e) => handleInputChange('airtableApiKey', e.target.value)}
                placeholder="Enter your Airtable API key"
                style={styles.input}
              />
              <div style={styles.help}>
                Find your API key at <a href="https://airtable.com/account" target="_blank" rel="noopener noreferrer" style={styles.link}>airtable.com/account</a>
              </div>
            </div>
            
            <div style={styles.field}>
              <label style={styles.label}>
                Base ID
                <span style={styles.required}>*</span>
              </label>
              <input
                type="text"
                value={settings.airtableBaseId}
                onChange={(e) => handleInputChange('airtableBaseId', e.target.value)}
                placeholder="app1234567890abcd"
                style={styles.input}
              />
              <div style={styles.help}>
                Find your Base ID in the Airtable API documentation for your base
              </div>
            </div>
          </div>
          
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Database Configuration</h3>
            
            <div style={styles.field}>
              <label style={styles.label}>
                PostgreSQL Connection URL
                <span style={styles.required}>*</span>
              </label>
              <input
                type="password"
                value={settings.databaseUrl}
                onChange={(e) => handleInputChange('databaseUrl', e.target.value)}
                placeholder="postgresql://username:password@localhost:5432/database"
                style={styles.input}
              />
              <div style={styles.help}>
                Format: postgresql://username:password@host:port/database
              </div>
            </div>
          </div>

          {message && (
            <div style={{
              ...styles.message,
              ...(messageType === 'error' ? styles.messageError : styles.messageSuccess)
            }}>
              {message}
            </div>
          )}

          {testResults && (
            <div style={styles.testResults}>
              <h4 style={styles.testResultsTitle}>Connection Test Results</h4>
              
              <div style={styles.testResult}>
                <span style={{
                  ...styles.testStatus,
                  color: testResults.airtable.success ? '#22c55e' : '#ef4444'
                }}>
                  {testResults.airtable.success ? '✓' : '✗'}
                </span>
                <span style={styles.testLabel}>Airtable:</span>
                <span style={styles.testMessage}>{testResults.airtable.message}</span>
              </div>
              
              <div style={styles.testResult}>
                <span style={{
                  ...styles.testStatus,
                  color: testResults.database.success ? '#22c55e' : '#ef4444'
                }}>
                  {testResults.database.success ? '✓' : '✗'}
                </span>
                <span style={styles.testLabel}>Database:</span>
                <span style={styles.testMessage}>{testResults.database.message}</span>
              </div>
            </div>
          )}
          
          <div style={styles.buttons}>
            <button
              onClick={handleTestConnections}
              disabled={!isFormValid || testing}
              style={{
                ...styles.button,
                ...styles.buttonSecondary,
                ...((!isFormValid || testing) ? styles.buttonDisabled : {})
              }}
            >
              {testing ? 'Testing...' : 'Test Connections'}
            </button>
            
            <button
              onClick={handleSave}
              disabled={!isFormValid || saving}
              style={{
                ...styles.button,
                ...styles.buttonPrimary,
                ...((!isFormValid || saving) ? styles.buttonDisabled : {})
              }}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '600px',
    margin: '0 auto',
    padding: '20px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '8px',
    color: '#333',
  },
  subtitle: {
    color: '#666',
    marginBottom: '30px',
  },
  loading: {
    textAlign: 'center' as const,
    padding: '40px',
    color: '#666',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '30px',
  },
  section: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '15px',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#333',
    marginBottom: '10px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '5px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#333',
  },
  required: {
    color: '#ef4444',
    marginLeft: '4px',
  },
  input: {
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '16px',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  help: {
    fontSize: '12px',
    color: '#666',
  },
  link: {
    color: '#3b82f6',
    textDecoration: 'none',
  },
  buttons: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
  },
  button: {
    padding: '12px 24px',
    border: 'none',
    borderRadius: '4px',
    fontSize: '16px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  buttonPrimary: {
    backgroundColor: '#3b82f6',
    color: 'white',
  },
  buttonSecondary: {
    backgroundColor: '#6b7280',
    color: 'white',
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af',
    cursor: 'not-allowed',
  },
  message: {
    padding: '12px',
    borderRadius: '4px',
    fontSize: '14px',
  },
  messageSuccess: {
    backgroundColor: '#d1fae5',
    color: '#065f46',
    border: '1px solid #10b981',
  },
  messageError: {
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    border: '1px solid #ef4444',
  },
  testResults: {
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '4px',
    padding: '16px',
  },
  testResultsTitle: {
    fontSize: '14px',
    fontWeight: '600',
    marginBottom: '12px',
    color: '#333',
  },
  testResult: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  testStatus: {
    fontSize: '16px',
    fontWeight: 'bold',
    width: '20px',
  },
  testLabel: {
    fontSize: '14px',
    fontWeight: '500',
    minWidth: '80px',
    color: '#333',
  },
  testMessage: {
    fontSize: '14px',
    color: '#666',
  },
};

export default Settings;