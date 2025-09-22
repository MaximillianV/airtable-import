import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { settingsAPI, importAPI } from '../services/api';
import { Settings, ImportSession, ImportProgress } from '../types';
import { socketService } from '../services/socket';

const Import: React.FC = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [tableNames, setTableNames] = useState<string>('');
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [discoveredTables, setDiscoveredTables] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [currentSession, setCurrentSession] = useState<ImportSession | null>(null);
  const [progress, setProgress] = useState<Record<string, ImportProgress>>({});
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

  const discoverTables = async () => {
    if (!tableNames.trim()) {
      setError('Please enter table names');
      return;
    }

    setDiscovering(true);
    setError('');
    
    try {
      const tables = tableNames.split(',').map(name => name.trim()).filter(name => name);
      const discoveryPromises = tables.map(async (tableName) => {
        try {
          const result = await importAPI.testTable(tableName);
          return { tableName, accessible: result.accessible, recordCount: result.recordCount };
        } catch (error) {
          return { tableName, accessible: false, recordCount: 0 };
        }
      });

      const results = await Promise.all(discoveryPromises);
      const accessibleTables = results.filter(r => r.accessible).map(r => r.tableName);
      
      setDiscoveredTables(accessibleTables);
      setSelectedTables(accessibleTables); // Pre-select all accessible tables
      
      if (accessibleTables.length === 0) {
        setError('No accessible tables found. Please check your table names and Airtable permissions.');
      } else if (accessibleTables.length < tables.length) {
        setError(`Found ${accessibleTables.length} out of ${tables.length} tables. Some tables may not be accessible.`);
      }
    } catch (error) {
      setError('Failed to discover tables. Please check your settings and table names.');
    } finally {
      setDiscovering(false);
    }
  };

  const startImport = async () => {
    if (selectedTables.length === 0) {
      setError('Please select at least one table to import');
      return;
    }

    setImporting(true);
    setError('');
    setProgress({});

    try {
      const result = await importAPI.start(selectedTables);
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
              <p>Enter the names of the Airtable tables you want to import, separated by commas.</p>
              
              <div style={styles.field}>
                <label style={styles.label}>Table Names</label>
                <textarea
                  value={tableNames}
                  onChange={(e) => setTableNames(e.target.value)}
                  placeholder="Table1, Table2, Table3..."
                  style={styles.textarea}
                  rows={3}
                />
              </div>
              
              <button
                onClick={discoverTables}
                disabled={discovering || !tableNames.trim()}
                style={{
                  ...styles.primaryButton,
                  opacity: (discovering || !tableNames.trim()) ? 0.6 : 1,
                  cursor: (discovering || !tableNames.trim()) ? 'not-allowed' : 'pointer',
                }}
              >
                {discovering ? 'Discovering...' : 'Discover Tables'}
              </button>
              
              {error && <div style={styles.error}>{error}</div>}
            </div>

            {discoveredTables.length > 0 && (
              <div style={styles.card}>
                <h2>Select Tables to Import</h2>
                <p>Choose which tables you want to import to your PostgreSQL database.</p>
                
                <div style={styles.tableList}>
                  {discoveredTables.map((tableName) => (
                    <label key={tableName} style={styles.tableOption}>
                      <input
                        type="checkbox"
                        checked={selectedTables.includes(tableName)}
                        onChange={() => handleTableToggle(tableName)}
                        style={styles.checkbox}
                      />
                      <span style={styles.tableName}>{tableName}</span>
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
                      setTableNames('');
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
};

export default Import;