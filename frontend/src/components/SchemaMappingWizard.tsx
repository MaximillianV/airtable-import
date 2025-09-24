/**
 * Schema Mapping Wizard Component
 * 
 * Provides comprehensive interface for previewing and conf      console.log('🔄 Starting schema preview request...');
      const token = localStorage.getItem('token');
      console.log('🔑 Token exists:', !!token);
      
      const data = await importAPI.getSchemaPreview();
      console.log('✅ Schema preview response received:', {
        dataType: typeof data,
        hasSuccess: data?.success,
        tableCount: data?.tables?.length
      });
      
      setSchemaData(data);se schema mappings.
 * Shows all Airtable tables and columns with naming conversion options.
 * Allows selection between different naming strategies and manual overrides.
 */
import React, { useState, useEffect } from 'react';
import { importAPI } from '../services/api';

// TypeScript interfaces for schema mapping data
interface ColumnPreview {
  original: string;
  snakeCase: string;
  singularSnakeCase: string;
  type: string;
  options: Record<string, any>;
}

interface TablePreview {
  id: string;
  name: {
    original: string;
    snakeCase: string;
    singularSnakeCase: string;
  };
  columns: ColumnPreview[];
  recordCount: number;
  error?: string;
}

interface SchemaPreviewResponse {
  success: boolean;
  baseId: string;
  tables: TablePreview[];
  totalTables: number;
  totalColumns: number;
}

// Configuration for naming strategies
type NamingStrategy = 'original' | 'snakeCase' | 'singularSnakeCase';

interface MappingConfiguration {
  globalStrategy: NamingStrategy;
  tableMappings: Record<string, string>; // tableId -> chosen name
  columnMappings: Record<string, Record<string, string>>; // tableId -> columnOriginal -> chosen name
}

/**
 * Props interface for the SchemaMappingWizard component
 */
interface SchemaMappingWizardProps {
  /** Callback when mapping configuration is finalized */
  onMappingComplete: (config: MappingConfiguration) => void;
  /** Callback to cancel the wizard */  
  onCancel: () => void;
  /** Optional initial configuration to load */
  initialConfig?: MappingConfiguration;
}

/**
 * SchemaMappingWizard component for configuring database schema mappings.
 * Displays all Airtable tables and columns with naming conversion previews.
 * Allows users to choose naming strategies and manually override specific names.
 */
const SchemaMappingWizard: React.FC<SchemaMappingWizardProps> = ({
  onMappingComplete,
  onCancel,
  initialConfig
}) => {
  // Component state management
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schemaData, setSchemaData] = useState<SchemaPreviewResponse | null>(null);
  const [config, setConfig] = useState<MappingConfiguration>({
    globalStrategy: 'snakeCase',
    tableMappings: {},
    columnMappings: {}
  });
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  // Load schema preview on component mount
  useEffect(() => {
    loadSchemaPreview();
  }, []);

  // Initialize configuration when schema data is loaded
  useEffect(() => {
    if (schemaData && schemaData.tables.length > 0) {
      initializeConfiguration();
    }
  }, [schemaData]);

  /**
   * Fetches schema preview data from the API.
   * Shows all tables and columns with naming conversion options.
   */
  const loadSchemaPreview = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 Starting schema preview request...');
      const token = localStorage.getItem('token');
      console.log('🔑 Token exists:', !!token);
      
      const data = await importAPI.getSchemaPreview();
      console.log('✅ Schema preview response received:', {
        dataType: typeof data,
        hasSuccess: data?.success,
        tableCount: data?.tables?.length
      });
      
      if (data && data.success) {
        setSchemaData(data);
        console.log('📋 Schema preview data set successfully');
      } else {
        throw new Error('API returned unsuccessful response');
      }
    } catch (error: any) {
      console.error('Failed to load schema preview:', error);
      const errorMessage = error.response?.data?.error || 
                          error.message || 
                          'Failed to load schema preview';
      console.error('Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      setError(`Schema preview error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Initializes the mapping configuration based on schema data and global strategy.
   * Sets up default mappings for all tables and columns.
   */
  const initializeConfiguration = () => {
    if (!schemaData) return;

    const newConfig: MappingConfiguration = {
      globalStrategy: initialConfig?.globalStrategy || 'snakeCase',
      tableMappings: initialConfig?.tableMappings ? { ...initialConfig.tableMappings } : {},
      columnMappings: initialConfig?.columnMappings ? { ...initialConfig.columnMappings } : {}
    };

    // Initialize table mappings based on global strategy
    schemaData.tables.forEach(table => {
      if (!newConfig.tableMappings[table.id]) {
        newConfig.tableMappings[table.id] = getNameByStrategy(
          table.name,
          newConfig.globalStrategy
        );
      }

      // Initialize column mappings for this table
      if (!newConfig.columnMappings[table.id]) {
        newConfig.columnMappings[table.id] = {};
      }

      table.columns.forEach(column => {
        if (!newConfig.columnMappings[table.id][column.original]) {
          newConfig.columnMappings[table.id][column.original] = getColumnNameByStrategy(
            column,
            newConfig.globalStrategy
          );
        }
      });
    });

    setConfig(newConfig);
  };

  /**
   * Gets the appropriate name based on the selected naming strategy.
   * @param nameOptions - Object containing all naming options
   * @param strategy - The naming strategy to apply
   * @returns The name according to the strategy
   */
  const getNameByStrategy = (
    nameOptions: { original: string; snakeCase: string; singularSnakeCase: string },
    strategy: NamingStrategy
  ): string => {
    switch (strategy) {
      case 'original':
        return nameOptions.original;
      case 'snakeCase':
        return nameOptions.snakeCase;
      case 'singularSnakeCase':
        return nameOptions.singularSnakeCase;
      default:
        return nameOptions.original;
    }
  };

  /**
   * Gets the appropriate column name based on the selected naming strategy.
   * @param column - Column preview data
   * @param strategy - The naming strategy to apply
   * @returns The column name according to the strategy
   */
  const getColumnNameByStrategy = (column: ColumnPreview, strategy: NamingStrategy): string => {
    switch (strategy) {
      case 'original':
        return column.original;
      case 'snakeCase':
      case 'singularSnakeCase': // Columns don't have plural/singular distinction
        return column.snakeCase;
      default:
        return column.original;
    }
  };

  /**
   * Handles changes to the global naming strategy.
   * Updates all table and column mappings to reflect the new strategy.
   */
  const handleGlobalStrategyChange = (strategy: NamingStrategy) => {
    if (!schemaData) return;

    const newConfig = { ...config };
    newConfig.globalStrategy = strategy;

    // Update all table mappings to use new strategy
    schemaData.tables.forEach(table => {
      newConfig.tableMappings[table.id] = getNameByStrategy(table.name, strategy);
      
      // Update all column mappings for this table
      table.columns.forEach(column => {
        newConfig.columnMappings[table.id][column.original] = getColumnNameByStrategy(
          column,
          strategy
        );
      });
    });

    setConfig(newConfig);
  };

  /**
   * Handles manual override of a table name.
   * @param tableId - ID of the table to update
   * @param newName - New name for the table
   */
  const handleTableNameChange = (tableId: string, newName: string) => {
    setConfig(prev => ({
      ...prev,
      tableMappings: {
        ...prev.tableMappings,
        [tableId]: newName
      }
    }));
  };

  /**
   * Handles manual override of a column name.
   * @param tableId - ID of the table containing the column
   * @param originalColumnName - Original name of the column
   * @param newName - New name for the column
   */
  const handleColumnNameChange = (tableId: string, originalColumnName: string, newName: string) => {
    setConfig(prev => ({
      ...prev,
      columnMappings: {
        ...prev.columnMappings,
        [tableId]: {
          ...prev.columnMappings[tableId],
          [originalColumnName]: newName
        }
      }
    }));
  };

  /**
   * Toggles the expansion state of a table to show/hide columns.
   * @param tableId - ID of the table to toggle
   */
  const toggleTableExpansion = (tableId: string) => {
    setExpandedTables(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tableId)) {
        newSet.delete(tableId);
      } else {
        newSet.add(tableId);
      }
      return newSet;
    });
  };

  /**
   * Handles completion of the mapping configuration.
   * Validates the configuration and calls the completion callback.
   */
  const handleComplete = () => {
    // Validate configuration
    const hasEmptyNames = Object.values(config.tableMappings).some(name => !name.trim()) ||
      Object.values(config.columnMappings).some(tableColumns =>
        Object.values(tableColumns).some(name => !name.trim())
      );

    if (hasEmptyNames) {
      setError('All table and column names must be non-empty');
      return;
    }

    // Check for duplicate table names
    const tableNames = Object.values(config.tableMappings);
    const duplicateTableNames = tableNames.filter((name, index) => 
      tableNames.indexOf(name) !== index
    );

    if (duplicateTableNames.length > 0) {
      setError(`Duplicate table names found: ${duplicateTableNames.join(', ')}`);
      return;
    }

    console.log('✅ Schema mapping configuration completed:', config);
    onMappingComplete(config);
  };

  // Loading state
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h2>Loading Schema Preview...</h2>
        </div>
        <div style={styles.loading}>
          <div style={styles.spinner}></div>
          <p>Fetching Airtable schema and generating naming previews...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h2>Schema Mapping Error</h2>
        </div>
        <div style={styles.error}>
          <p>{error}</p>
          <div style={styles.buttonRow}>
            <button onClick={loadSchemaPreview} style={styles.primaryButton}>
              Retry
            </button>
            <button onClick={onCancel} style={styles.secondaryButton}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main wizard interface
  return (
    <div style={styles.container}>
      {/* Wizard Header */}
      <div style={styles.header}>
        <h2>🏗️ Database Schema Mapping Wizard</h2>
        <p>Configure how your Airtable data will be mapped to database tables and columns.</p>
        
        {schemaData && (
          <div style={styles.stats}>
            <span>📊 Base: {schemaData.baseId}</span>
            <span>📋 {schemaData.totalTables} tables</span>
            <span>📝 {schemaData.totalColumns} columns</span>
          </div>
        )}
      </div>

      {/* Global Strategy Selection */}
      <div style={styles.section}>
        <h3>🎯 Global Naming Strategy</h3>
        <p>Choose the default naming convention for all tables and columns:</p>
        
        <div style={styles.strategyOptions}>
          <label style={styles.radioLabel}>
            <input
              type="radio"
              name="globalStrategy"
              value="original"
              checked={config.globalStrategy === 'original'}
              onChange={(e) => handleGlobalStrategyChange(e.target.value as NamingStrategy)}
              style={styles.radio}
            />
            <div>
              <strong>Keep Original Names</strong>
              <br />
              <small>Preserve Airtable names exactly as they are</small>
            </div>
          </label>

          <label style={styles.radioLabel}>
            <input
              type="radio"
              name="globalStrategy"
              value="snakeCase"
              checked={config.globalStrategy === 'snakeCase'}
              onChange={(e) => handleGlobalStrategyChange(e.target.value as NamingStrategy)}
              style={styles.radio}
            />
            <div>
              <strong>Snake Case (Recommended)</strong>
              <br />
              <small>Convert to snake_case, preserve plural forms</small>
            </div>
          </label>

          <label style={styles.radioLabel}>
            <input
              type="radio"
              name="globalStrategy"
              value="singularSnakeCase"
              checked={config.globalStrategy === 'singularSnakeCase'}
              onChange={(e) => handleGlobalStrategyChange(e.target.value as NamingStrategy)}
              style={styles.radio}
            />
            <div>
              <strong>Singular Snake Case</strong>
              <br />
              <small>Convert to snake_case with singular table names</small>
            </div>
          </label>
        </div>
      </div>

      {/* Tables and Columns Mapping */}
      <div style={styles.section}>
        <h3>📋 Table and Column Mappings</h3>
        <p>Review and customize individual table and column names:</p>

        <div style={styles.tablesList}>
          {schemaData?.tables.map(table => (
            <div key={table.id} style={styles.tableCard}>
              {/* Table Header */}
              <div style={styles.tableHeader} onClick={() => toggleTableExpansion(table.id)}>
                <div style={styles.tableHeaderLeft}>
                  <span style={styles.expandIcon}>
                    {expandedTables.has(table.id) ? '📂' : '📁'}
                  </span>
                  <div>
                    <strong>{table.name.original}</strong>
                    {table.error && <span style={styles.errorBadge}>Error</span>}
                  </div>
                </div>
                <div style={styles.tableHeaderRight}>
                  <span style={styles.recordCount}>{table.recordCount} records</span>
                </div>
              </div>

              {/* Table Name Mapping */}
              <div style={styles.nameMapping}>
                <label style={styles.inputLabel}>Database Table Name:</label>
                <input
                  type="text"
                  value={config.tableMappings[table.id] || ''}
                  onChange={(e) => handleTableNameChange(table.id, e.target.value)}
                  style={styles.nameInput}
                  placeholder="Enter table name..."
                />
                <div style={styles.previewText}>
                  Original: "{table.name.original}" → Database: "{config.tableMappings[table.id]}"
                </div>
              </div>

              {/* Columns (when expanded) */}
              {expandedTables.has(table.id) && (
                <div style={styles.columnsSection}>
                  <h4>📝 Columns ({table.columns.length})</h4>
                  {table.columns.length === 0 ? (
                    <p style={styles.noColumns}>No columns found or schema fetch error</p>
                  ) : (
                    <div style={styles.columnsList}>
                      {table.columns.map(column => (
                        <div key={column.original} style={styles.columnRow}>
                          <div style={styles.columnInfo}>
                            <strong>{column.original}</strong>
                            <span style={styles.columnType}>{column.type}</span>
                          </div>
                          <div style={styles.columnMapping}>
                            <input
                              type="text"
                              value={config.columnMappings[table.id]?.[column.original] || ''}
                              onChange={(e) => handleColumnNameChange(table.id, column.original, e.target.value)}
                              style={styles.columnInput}
                              placeholder="Column name..."
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={styles.actions}>
        <button onClick={onCancel} style={styles.secondaryButton}>
          Cancel
        </button>
        <button onClick={handleComplete} style={styles.primaryButton}>
          Apply Mapping & Continue
        </button>
      </div>
    </div>
  );
};

// Styles for the component
const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '30px',
    paddingBottom: '20px',
    borderBottom: '2px solid #e5e7eb'
  },
  stats: {
    display: 'flex',
    justifyContent: 'center',
    gap: '20px',
    marginTop: '10px',
    fontSize: '14px',
    color: '#6b7280'
  },
  loading: {
    textAlign: 'center' as const,
    padding: '40px'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #f3f4f6',
    borderTop: '4px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 20px'
  },
  error: {
    textAlign: 'center' as const,
    padding: '40px',
    color: '#dc2626'
  },
  section: {
    marginBottom: '40px',
    padding: '20px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    border: '1px solid #e5e7eb'
  },
  strategyOptions: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '15px',
    marginTop: '15px'
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '15px',
    backgroundColor: 'white',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  radio: {
    marginTop: '2px'
  },
  tablesList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '15px',
    marginTop: '15px'
  },
  tableCard: {
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    overflow: 'hidden'
  },
  tableHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '15px 20px',
    backgroundColor: '#f9fafb',
    cursor: 'pointer',
    borderBottom: '1px solid #e5e7eb'
  },
  tableHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  tableHeaderRight: {
    fontSize: '14px',
    color: '#6b7280'
  },
  expandIcon: {
    fontSize: '18px'
  },
  recordCount: {
    backgroundColor: '#e5e7eb',
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '12px'
  },
  errorBadge: {
    backgroundColor: '#fecaca',
    color: '#dc2626',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '12px',
    marginLeft: '8px'
  },
  nameMapping: {
    padding: '20px',
    borderBottom: '1px solid #f3f4f6'
  },
  inputLabel: {
    display: 'block',
    marginBottom: '8px',
    fontWeight: 'bold',
    color: '#374151'
  },
  nameInput: {
    width: '100%',
    padding: '10px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px'
  },
  previewText: {
    marginTop: '8px',
    fontSize: '12px',
    color: '#6b7280',
    fontStyle: 'italic'
  },
  columnsSection: {
    padding: '20px',
    backgroundColor: '#fafbfc'
  },
  noColumns: {
    fontStyle: 'italic',
    color: '#6b7280',
    textAlign: 'center' as const,
    padding: '20px'
  },
  columnsList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px'
  },
  columnRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px',
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '4px'
  },
  columnInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    flex: 1
  },
  columnType: {
    fontSize: '12px',
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    padding: '2px 6px',
    borderRadius: '12px',
    marginTop: '4px',
    alignSelf: 'flex-start'
  },
  columnMapping: {
    flex: 1,
    marginLeft: '20px'
  },
  columnInput: {
    width: '100%',
    padding: '6px 10px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontSize: '13px'
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '15px',
    marginTop: '30px',
    paddingTop: '20px',
    borderTop: '1px solid #e5e7eb'
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    padding: '12px 20px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  secondaryButton: {
    backgroundColor: 'white',
    color: '#374151',
    border: '1px solid #d1d5db',
    padding: '12px 20px',
    borderRadius: '6px',
    cursor: 'pointer'
  },
  buttonRow: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'center',
    marginTop: '20px'
  }
};

export default SchemaMappingWizard;