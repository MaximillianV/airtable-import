import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { settingsAPI, importAPI } from '../services/api';
import { Settings, ImportSession, ImportProgress, DiscoveredTable } from '../types';
import { socketService } from '../services/socket';

const Import: React.FC = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [discoveredTables, setDiscoveredTables] = useState<DiscoveredTable[]>([]);
  const [importing, setImporting] = useState(false);
  const [currentSession, setCurrentSession] = useState<ImportSession | null>(null);
  const [progress, setProgress] = useState<Record<string, ImportProgress>>({});
  const [overwrite, setOverwrite] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadSettings();
    
    // Setup socket listeners for real-time updates
    const unsubscribe = socketService.onProgressUpdate((data: ImportProgress) => {
      setProgress(prev => ({
        ...prev,
        [data.table]: data
      }));
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Auto-discover tables when settings are loaded successfully
  useEffect(() => {
    if (settings && settings.airtableApiKey && settings.airtableBaseId && discoveredTables.length === 0 && !discovering) {
      console.log('Auto-discovering tables with loaded settings...');
      discoverTables();
    }
  }, [settings]);

  const loadSettings = async () => {
    try {
      const settingsData = await settingsAPI.get();
      if (!settingsData.airtableApiKey || !settingsData.airtableBaseId || !settingsData.databaseUrl) {
        setError('Please configure your settings before importing');
        return;
      }
      setSettings(settingsData as Settings);
    } catch (error) {
      setError('Failed to load settings');
    }
  };

  /**
   * Automatically discovers all tables in the Airtable base using the Metadata API.
   * Fetches table information including names, IDs, and record counts.
   * Replaces manual table entry with automatic discovery.
   */
  const discoverTables = async () => {
    setDiscovering(true);
    setError('');
    setDiscoveredTables([]);
    setSelectedTables([]);
    
    try {
      console.log('Starting automatic table discovery...');
      const result = await importAPI.discoverTables();
      
      if (result.success && result.tables.length > 0) {
        setDiscoveredTables(result.tables);
        
        // Pre-select all accessible tables (those without errors)
        const accessibleTableNames = result.tables
          .filter(table => table.recordCount >= 0 && !table.error)
          .map(table => table.name);
        setSelectedTables(accessibleTableNames);
        
        // Show summary message
        const totalTables = result.tables.length;
        const accessibleCount = accessibleTableNames.length;
        
        if (accessibleCount === totalTables) {
          console.log(`✅ Successfully discovered ${totalTables} accessible tables`);
        } else {
          const errorMessage = `Found ${totalTables} tables, but only ${accessibleCount} are accessible. Check permissions for the others.`;
          console.warn(errorMessage);
          setError(errorMessage);
        }
      } else {
        setError(result.message || 'No tables found in your Airtable base');
      }
    } catch (error: any) {
      console.error('Table discovery failed:', error);
      
      // Provide specific error messages based on the error type
      let errorMessage = 'Failed to discover tables. ';
      
      if (error.response?.status === 401) {
        errorMessage += 'Invalid API key - please check your Airtable settings.';
      } else if (error.response?.status === 403) {
        errorMessage += 'Access denied - please verify your API key has the correct permissions.';
      } else if (error.response?.status === 404) {
        errorMessage += 'Base not found - please verify your Base ID is correct.';
      } else if (error.response?.status >= 500) {
        errorMessage += 'Server error - please try again in a moment.';
      } else if (error.message?.includes('Network')) {
        errorMessage += 'Network error - please check your internet connection.';
      } else {
        errorMessage += error.response?.data?.error || error.message || 'Please check your settings and try again.';
      }
      
      setError(errorMessage);
    } finally {
      setDiscovering(false);
    }
  };

  /**
   * Starts the import process with selected tables.
   * Sends enhanced table data including metadata for better tracking.
   */
  const startImport = async () => {
    if (selectedTables.length === 0) {
      setError('Please select at least one table to import');
      return;
    }

    setImporting(true);
    setError('');
    setProgress({});

    try {
      // Prepare enhanced table data with metadata for import
      const selectedTableObjects = discoveredTables.filter(table => 
        selectedTables.includes(table.name)
      );

      console.log(`Starting import for ${selectedTableObjects.length} tables:`, 
        selectedTableObjects.map(t => `${t.name} (${t.recordCount} records)`).join(', '));

      // Send both formats for backward compatibility, including overwrite flag
      const result = await importAPI.start(selectedTables, selectedTableObjects, overwrite);
      setCurrentSession(result);
      
      // Connect to socket for real-time updates
      socketService.connect();
      socketService.joinSession(result.sessionId);
      
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to start import');
      setImporting(false);
    }
  };

  const handleTableToggle = (tableName: string) => {
    setSelectedTables(prev => 
      prev.includes(tableName) 
        ? prev.filter(t => t !== tableName)
        : [...prev, tableName]
    );
  };

  const getProgressPercentage = (progress: ImportProgress): number => {
    if (progress.status === 'completed') return 100;
    if (progress.status === 'error') return 0;
    if (!progress.totalRecords || !progress.recordsProcessed) return 0;
    return Math.round((progress.recordsProcessed / progress.totalRecords) * 100);
  };

  const getProgressColor = (status: string): string => {
    switch (status) {
      case 'completed':
        return '#22c55e';
      case 'error':
        return '#ef4444';
      case 'running':
      case 'fetching':
      case 'creating_table':
      case 'inserting':
        return '#3b82f6';
      default:
        return '#6b7280';
    }
  };

  if (!settings) {
    return (
      <div style={styles.container}>
        <div style={styles.errorCard}>
          <h2>Settings Required</h2>
          <p>{error || 'Please configure your settings before importing'}</p>
          <Link to="/settings" style={styles.primaryButton}>
            Go to Settings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Import from Airtable</h1>
        <Link to="/dashboard" style={styles.backButton}>
          ← Back to Dashboard
        </Link>
      </header>

      <div style={styles.content}>
        {!importing ? (
          <div style={styles.setupSection}>
            <div style={styles.card}>
              <h2>Discover Tables</h2>
              <p>Automatically discover all tables in your Airtable base with record counts.</p>
              
              <div style={styles.discoveryActions}>
                <button
                  onClick={discoverTables}
                  disabled={discovering}
                  style={{
                    ...styles.primaryButton,
                    opacity: discovering ? 0.6 : 1,
                    cursor: discovering ? 'not-allowed' : 'pointer',
                  }}
                >
                  {discovering ? 'Discovering Tables...' : 
                   discoveredTables.length > 0 ? 'Refresh Tables' : 'Discover Tables'}
                </button>
                
                {error && (
                  <button
                    onClick={discoverTables}
                    disabled={discovering}
                    style={{
                      ...styles.secondaryButton,
                      marginLeft: '8px',
                      opacity: discovering ? 0.6 : 1,
                      cursor: discovering ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Retry
                  </button>
                )}
              </div>
              
              {error && (
                <div style={styles.error}>
                  {error}
                  <div style={styles.errorHelp}>
                    Need help? Check your <Link to="/settings" style={styles.errorLink}>settings</Link> or 
                    verify your Airtable permissions.
                  </div>
                </div>
              )}
            </div>

            {discoveredTables.length > 0 && (
              <div style={styles.card}>
                <h2>Select Tables to Import</h2>
                <p>Choose which tables you want to import to your PostgreSQL database.</p>
                
                <div style={styles.bulkActions}>
                  <button
                    onClick={() => {
                      const accessibleTables = discoveredTables
                        .filter(table => table.recordCount >= 0 && !table.error)
                        .map(table => table.name);
                      setSelectedTables(accessibleTables);
                    }}
                    style={styles.secondaryButton}
                  >
                    Select All Accessible
                  </button>
                  <button
                    onClick={() => setSelectedTables([])}
                    style={styles.secondaryButton}
                  >
                    Deselect All
                  </button>
                </div>
                
                <div style={styles.importOptions}>
                  <label style={styles.optionLabel}>
                    <input
                      type="checkbox"
                      checked={overwrite}
                      onChange={(e) => setOverwrite(e.target.checked)}
                      style={styles.optionCheckbox}
                    />
                    <div style={styles.optionDetails}>
                      <span style={styles.optionTitle}>Overwrite existing tables</span>
                      <span style={styles.optionDescription}>
                        {overwrite 
                          ? 'Drop and recreate tables, replacing all existing data'
                          : 'Skip existing tables and sync new records only (recommended)'
                        }
                      </span>
                    </div>
                  </label>
                </div>
                
                <div style={styles.tableList}>
                  {discoveredTables.map((table) => (
                    <label key={table.id} style={styles.tableOption}>
                      <input
                        type="checkbox"
                        checked={selectedTables.includes(table.name)}
                        onChange={() => handleTableToggle(table.name)}
                        disabled={table.recordCount < 0 || !!table.error}
                        style={styles.checkbox}
                      />
                      <div style={styles.tableInfo}>
                        <span style={styles.tableName}>{table.name}</span>
                        <div style={styles.tableDetails}>
                          {table.recordCount >= 0 ? (
                            <span style={styles.recordCount}>
                              {table.recordCount.toLocaleString()} records
                            </span>
                          ) : (
                            <span style={styles.errorText}>
                              {table.error || 'Unable to access'}
                            </span>
                          )}
                          {table.description && (
                            <span style={styles.tableDescription}>
                              {table.description}
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
                
                <button
                  onClick={startImport}
                  disabled={selectedTables.length === 0}
                  style={{
                    ...styles.primaryButton,
                    opacity: selectedTables.length === 0 ? 0.6 : 1,
                    cursor: selectedTables.length === 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  Start Import ({selectedTables.length} tables)
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={styles.progressSection}>
            <div style={styles.card}>
              <h2>Import in Progress</h2>
              <p>Session ID: {currentSession?.sessionId}</p>
              
              <div style={styles.progressList}>
                {selectedTables.map((tableName) => {
                  const tableProgress = progress[tableName];
                  const percentage = tableProgress ? getProgressPercentage(tableProgress) : 0;
                  const status = tableProgress?.status || 'waiting';
                  
                  return (
                    <div key={tableName} style={styles.progressItem}>
                      <div style={styles.progressHeader}>
                        <span style={styles.progressTable}>{tableName}</span>
                        <span style={styles.progressStatus}>
                          {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                        </span>
                      </div>
                      
                      <div style={styles.progressBarContainer}>
                        <div
                          style={{
                            ...styles.progressBar,
                            width: `${percentage}%`,
                            backgroundColor: getProgressColor(status),
                          }}
                        />
                      </div>
                      
                      <div style={styles.progressDetails}>
                        {tableProgress?.recordsProcessed && tableProgress?.totalRecords ? (
                          <span>{tableProgress.recordsProcessed} / {tableProgress.totalRecords} records</span>
                        ) : (
                          <span>{percentage}%</span>
                        )}
                        {tableProgress?.message && (
                          <span style={styles.progressMessage}>{tableProgress.message}</span>
                        )}
                        {tableProgress?.error && (
                          <span style={styles.progressError}>{tableProgress.error}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {Object.values(progress).every(p => p.status === 'completed' || p.status === 'error') && (
                <div style={styles.completionActions}>
                  <button
                    onClick={() => navigate('/dashboard')}
                    style={styles.primaryButton}
                  >
                    Back to Dashboard
                  </button>
                  <button
                    onClick={() => {
                      setImporting(false);
                      setCurrentSession(null);
                      setProgress({});
                      setDiscoveredTables([]);
                      setSelectedTables([]);
                      setError('');
                    }}
                    style={styles.secondaryButton}
                  >
                    Start New Import
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f8fafc',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
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
  backButton: {
    color: '#6b7280',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: '500',
  },
  content: {
    padding: '24px',
    maxWidth: '800px',
    margin: '0 auto',
  },
  setupSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
  },
  progressSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '24px',
    border: '1px solid #e5e7eb',
  },
  errorCard: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '32px',
    border: '1px solid #e5e7eb',
    textAlign: 'center' as const,
    maxWidth: '400px',
    margin: '0 auto',
    marginTop: '64px',
  },
  field: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    marginBottom: '4px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
  },
  textarea: {
    width: '100%',
    padding: '12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    resize: 'vertical' as const,
    fontFamily: 'inherit',
  },
  tableList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    marginBottom: '24px',
  },
  tableOption: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    cursor: 'pointer',
    backgroundColor: '#f9fafb',
  },
  checkbox: {
    width: '16px',
    height: '16px',
  },
  tableName: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
  },
  primaryButton: {
    display: 'inline-block',
    padding: '12px 24px',
    backgroundColor: '#3b82f6',
    color: 'white',
    textDecoration: 'none',
    border: 'none',
    borderRadius: '6px',
    fontWeight: '500',
    cursor: 'pointer',
    fontSize: '14px',
  },
  secondaryButton: {
    display: 'inline-block',
    padding: '12px 24px',
    backgroundColor: '#6b7280',
    color: 'white',
    textDecoration: 'none',
    border: 'none',
    borderRadius: '6px',
    fontWeight: '500',
    cursor: 'pointer',
    fontSize: '14px',
    marginLeft: '12px',
  },
  error: {
    color: '#dc2626',
    fontSize: '14px',
    marginTop: '12px',
    padding: '12px',
    backgroundColor: '#fee2e2',
    border: '1px solid #fecaca',
    borderRadius: '4px',
  },
  progressList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
    marginBottom: '24px',
  },
  progressItem: {
    padding: '16px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    backgroundColor: '#f9fafb',
  },
  progressHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  progressTable: {
    fontWeight: '600',
    color: '#374151',
  },
  progressStatus: {
    fontSize: '12px',
    fontWeight: '500',
    color: '#6b7280',
    textTransform: 'uppercase' as const,
  },
  progressBarContainer: {
    width: '100%',
    height: '8px',
    backgroundColor: '#e5e7eb',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '8px',
  },
  progressBar: {
    height: '100%',
    transition: 'width 0.3s ease',
  },
  progressDetails: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '12px',
    color: '#6b7280',
  },
  progressMessage: {
    color: '#3b82f6',
  },
  progressError: {
    color: '#dc2626',
  },
  completionActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
  },
  bulkActions: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
  },
  tableInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    flex: 1,
  },
  tableDetails: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
  },
  recordCount: {
    fontSize: '12px',
    color: '#6b7280',
    fontWeight: '500',
  },
  errorText: {
    fontSize: '12px',
    color: '#dc2626',
    fontStyle: 'italic',
  },
  tableDescription: {
    fontSize: '11px',
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  discoveryActions: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '16px',
  },
  errorHelp: {
    marginTop: '8px',
    fontSize: '12px',
    color: '#6b7280',
  },
  errorLink: {
    color: '#3b82f6',
    textDecoration: 'none',
    fontWeight: '500',
  },
  importOptions: {
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px',
  },
  optionLabel: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    cursor: 'pointer',
  },
  optionCheckbox: {
    width: '18px',
    height: '18px',
    marginTop: '2px',
    cursor: 'pointer',
  },
  optionDetails: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  optionTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
  },
  optionDescription: {
    fontSize: '12px',
    color: '#6b7280',
    lineHeight: '1.4',
  },
};

export default Import;