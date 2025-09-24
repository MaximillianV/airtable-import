/**
 * RelationshipDebugger Component
 * 
 * Provides detailed debugging information about relationship detection
 * to help troubleshoot why certain relationships are being classified
 * as many-to-many when they might not be.
 * 
 * @author GitHub Copilot
 * @version 1.0.0
 */

import React, { useState, useEffect } from 'react';
import { importAPI } from '../services/api';

/**
 * Interface for debugging data structure returned by the debug API
 */
interface DebugData {
  tables: Array<{
    name: string;
    id: string;
    recordCount: number;
    fields: Array<{
      name: string;
      type: string;
      isLinkedRecord: boolean;
    }>;
    linkedFields: Array<{
      sourceTable: string;
      fieldName: string;
      fieldType: string;
      linkedTableName?: string;
      detectedRelationshipType: string;
      allowsMultiple: boolean;
      inverseField?: {
        name: string;
        type: string;
        allowsMultiple: boolean;
      };
    }>;
    relationshipCount: number;
  }>;
  linkedFields: Array<any>;
  fieldTypeDistribution: Record<string, number>;
  potentialIssues: string[];
  summary: {
    totalTables: number;
    totalFields: number;
    linkedRecordFields: number;
  };
}

/**
 * Props interface for the RelationshipDebugger component
 */
interface RelationshipDebuggerProps {
  /** Whether to show the debugger in expanded mode initially */
  initiallyExpanded?: boolean;
  /** Callback when debug analysis is complete */
  onAnalysisComplete?: (data: DebugData) => void;
}

/**
 * RelationshipDebugger component provides detailed analysis of relationship detection
 * to help identify why relationships might be incorrectly classified.
 */
const RelationshipDebugger: React.FC<RelationshipDebuggerProps> = ({ 
  initiallyExpanded = false, 
  onAnalysisComplete 
}) => {
  // State management for debug data and UI
  const [debugData, setDebugData] = useState<DebugData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  /**
   * Loads comprehensive debugging information from the backend
   * Analyzes all linked record fields and their relationship classifications
   */
  const loadDebugData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔍 Loading relationship debugging data...');
      const response = await importAPI.debugRelationships();
      
      if (response.success) {
        setDebugData(response.data);
        console.log(`🔍 Debug data loaded: ${response.data.linkedFields.length} linked fields analyzed`);
        onAnalysisComplete?.(response.data);
      } else {
        throw new Error(response.error || 'Failed to load debug data');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('❌ Failed to load debug data:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Automatically load debug data when component mounts if initially expanded
   */
  useEffect(() => {
    if (initiallyExpanded && !debugData) {
      loadDebugData();
    }
  }, [initiallyExpanded]);

  /**
   * Renders a summary of field type distribution across all tables
   */
  const renderFieldTypeDistribution = () => {
    if (!debugData?.fieldTypeDistribution) return null;

    return (
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Field Type Distribution</h4>
        <div style={styles.distributionGrid}>
          {Object.entries(debugData.fieldTypeDistribution).map(([fieldType, count]) => (
            <div key={fieldType} style={styles.distributionItem}>
              <span style={styles.fieldType}>{fieldType}</span>
              <span style={styles.fieldCount}>{count} fields</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  /**
   * Renders detailed information about linked record fields and their relationships
   */
  const renderLinkedFieldsAnalysis = () => {
    if (!debugData?.linkedFields) return null;

    const manyToManyFields = debugData.linkedFields.filter(f => f.detectedRelationshipType === 'many-to-many');
    const otherRelationships = debugData.linkedFields.filter(f => f.detectedRelationshipType !== 'many-to-many');

    return (
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>
          Linked Record Fields Analysis 
          <span style={styles.badge}>{debugData.linkedFields.length} total</span>
        </h4>
        
        {/* Summary statistics */}
        <div style={styles.summaryStats}>
          <div style={styles.statItem}>
            <span style={styles.statLabel}>Many-to-Many:</span>
            <span style={styles.statValue}>{manyToManyFields.length}</span>
          </div>
          <div style={styles.statItem}>
            <span style={styles.statLabel}>Other Types:</span>
            <span style={styles.statValue}>{otherRelationships.length}</span>
          </div>
          <div style={styles.statItem}>
            <span style={styles.statLabel}>M:M Ratio:</span>
            <span style={styles.statValue}>
              {((manyToManyFields.length / Math.max(debugData.linkedFields.length, 1)) * 100).toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Detailed field analysis */}
        <div style={styles.fieldsList}>
          {debugData.linkedFields.map((field, index) => (
            <div key={index} style={styles.fieldItem}>
              <div style={styles.fieldHeader}>
                <span style={styles.fieldPath}>
                  {field.sourceTable}.{field.fieldName}
                </span>
                <span style={styles.relationshipType}>
                  {field.detectedRelationshipType}
                </span>
              </div>
              
              <div style={styles.fieldDetails}>
                <div><strong>Field Type:</strong> {field.fieldType}</div>
                <div><strong>Target Table:</strong> {field.linkedTableName || 'Unknown'}</div>
                <div><strong>Allows Multiple:</strong> {field.allowsMultiple ? 'Yes' : 'No'}</div>
                
                {field.inverseField && (
                  <div style={styles.inverseField}>
                    <strong>Inverse Field:</strong> {field.inverseField.name} 
                    ({field.inverseField.allowsMultiple ? 'Multiple' : 'Single'})
                  </div>
                )}
                
                {!field.inverseField && (
                  <div style={styles.warning}>⚠️ No inverse field found</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  /**
   * Renders potential issues and troubleshooting recommendations
   */
  const renderPotentialIssues = () => {
    if (!debugData?.potentialIssues || debugData.potentialIssues.length === 0) return null;

    return (
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Potential Issues & Recommendations</h4>
        <div style={styles.issuesList}>
          {debugData.potentialIssues.map((issue, index) => (
            <div key={index} style={styles.issueItem}>
              <span style={styles.issueIcon}>⚠️</span>
              <span style={styles.issueText}>{issue}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      <div style={styles.header} onClick={() => setExpanded(!expanded)}>
        <h3 style={styles.title}>
          🔍 Relationship Debug Analyzer
          {debugData && (
            <span style={styles.badge}>
              {debugData.linkedFields.length} linked fields
            </span>
          )}
        </h3>
        <button style={styles.toggleButton}>
          {expanded ? '▼' : '▶'}
        </button>
      </div>

      {expanded && (
        <div style={styles.content}>
          {!debugData && !loading && (
            <div style={styles.loadPrompt}>
              <p>Click the button below to analyze your Airtable relationships and identify potential issues.</p>
              <button 
                onClick={loadDebugData}
                style={styles.analyzeButton}
                disabled={loading}
              >
                🔍 Analyze Relationships
              </button>
            </div>
          )}

          {loading && (
            <div style={styles.loading}>
              <div style={styles.spinner}></div>
              <p>Analyzing relationships and field configurations...</p>
            </div>
          )}

          {error && (
            <div style={styles.error}>
              <h4>❌ Analysis Failed</h4>
              <p>{error}</p>
              <button 
                onClick={loadDebugData}
                style={styles.retryButton}
              >
                🔄 Retry Analysis
              </button>
            </div>
          )}

          {debugData && (
            <div style={styles.results}>
              <div style={styles.summary}>
                <h4>📊 Summary</h4>
                <p>
                  Analyzed <strong>{debugData.summary.totalTables}</strong> tables with{' '}
                  <strong>{debugData.summary.totalFields}</strong> total fields.{' '}
                  Found <strong>{debugData.summary.linkedRecordFields}</strong> linked record fields.
                </p>
              </div>

              {renderFieldTypeDistribution()}
              {renderLinkedFieldsAnalysis()}
              {renderPotentialIssues()}

              <div style={styles.actions}>
                <button 
                  onClick={loadDebugData}
                  style={styles.refreshButton}
                  disabled={loading}
                >
                  🔄 Refresh Analysis
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Styling for the component with consistent design patterns
const styles = {
  // Main container with border and background
  container: {
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    backgroundColor: '#ffffff',
    marginBottom: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  } as React.CSSProperties,

  // Clickable header for expand/collapse functionality
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #e5e7eb',
    cursor: 'pointer',
    backgroundColor: '#f8fafc'
  } as React.CSSProperties,

  // Main title with debugging icon
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
    color: '#1f2937',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  } as React.CSSProperties,

  // Badge for showing counts
  badge: {
    backgroundColor: '#3b82f6',
    color: 'white',
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 500
  } as React.CSSProperties,

  // Toggle button for expand/collapse
  toggleButton: {
    border: 'none',
    background: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    color: '#6b7280'
  } as React.CSSProperties,

  // Main content area
  content: {
    padding: '20px'
  } as React.CSSProperties,

  // Section containers
  section: {
    marginBottom: '24px',
    padding: '16px',
    backgroundColor: '#f9fafb',
    borderRadius: '6px',
    border: '1px solid #e5e7eb'
  } as React.CSSProperties,

  // Section titles
  sectionTitle: {
    margin: '0 0 12px 0',
    fontSize: '16px',
    fontWeight: 600,
    color: '#374151'
  } as React.CSSProperties,

  // Grid layout for field type distribution
  distributionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '12px'
  } as React.CSSProperties,

  // Individual distribution items
  distributionItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 12px',
    backgroundColor: 'white',
    borderRadius: '4px',
    border: '1px solid #d1d5db'
  } as React.CSSProperties,

  // Field type labels
  fieldType: {
    fontWeight: 500,
    color: '#374151'
  } as React.CSSProperties,

  // Field count values
  fieldCount: {
    color: '#6b7280'
  } as React.CSSProperties,

  // Summary statistics layout
  summaryStats: {
    display: 'flex',
    gap: '20px',
    marginBottom: '16px',
    flexWrap: 'wrap' as const
  } as React.CSSProperties,

  // Individual stat items
  statItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '12px',
    backgroundColor: 'white',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    minWidth: '120px'
  } as React.CSSProperties,

  // Stat labels
  statLabel: {
    fontSize: '12px',
    color: '#6b7280',
    marginBottom: '4px'
  } as React.CSSProperties,

  // Stat values
  statValue: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#1f2937'
  } as React.CSSProperties,

  // List container for fields
  fieldsList: {
    maxHeight: '400px',
    overflowY: 'auto' as const,
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    backgroundColor: 'white'
  } as React.CSSProperties,

  // Individual field items
  fieldItem: {
    padding: '12px',
    borderBottom: '1px solid #e5e7eb'
  } as React.CSSProperties,

  // Field header with name and relationship type
  fieldHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  } as React.CSSProperties,

  // Field path (table.field)
  fieldPath: {
    fontWeight: 600,
    color: '#1f2937'
  } as React.CSSProperties,

  // Relationship type indicator
  relationshipType: {
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 500,
    backgroundColor: '#fef3c7',
    color: '#92400e'
  } as React.CSSProperties,

  // Field details container
  fieldDetails: {
    fontSize: '14px',
    color: '#6b7280',
    lineHeight: 1.5
  } as React.CSSProperties,

  // Inverse field information
  inverseField: {
    backgroundColor: '#f0f9ff',
    padding: '8px',
    borderRadius: '4px',
    border: '1px solid #bae6fd',
    marginTop: '8px'
  } as React.CSSProperties,

  // Warning messages
  warning: {
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    padding: '8px',
    borderRadius: '4px',
    border: '1px solid #fecaca',
    marginTop: '8px'
  } as React.CSSProperties,

  // Issues list container
  issuesList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px'
  } as React.CSSProperties,

  // Individual issue items
  issueItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '12px',
    backgroundColor: '#fef2f2',
    borderRadius: '6px',
    border: '1px solid #fecaca'
  } as React.CSSProperties,

  // Issue icon
  issueIcon: {
    fontSize: '16px',
    marginTop: '2px'
  } as React.CSSProperties,

  // Issue text
  issueText: {
    color: '#dc2626',
    fontSize: '14px',
    lineHeight: 1.5
  } as React.CSSProperties,

  // Loading state container
  loading: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '40px',
    color: '#6b7280'
  } as React.CSSProperties,

  // Loading spinner animation
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #e5e7eb',
    borderTop: '3px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '16px'
  } as React.CSSProperties,

  // Error state container
  error: {
    padding: '20px',
    backgroundColor: '#fef2f2',
    borderRadius: '6px',
    border: '1px solid #fecaca',
    textAlign: 'center' as const
  } as React.CSSProperties,

  // Load prompt for initial state
  loadPrompt: {
    textAlign: 'center' as const,
    padding: '40px'
  } as React.CSSProperties,

  // Main analyze button
  analyzeButton: {
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: 500,
    cursor: 'pointer',
    marginTop: '16px'
  } as React.CSSProperties,

  // Retry button for errors
  retryButton: {
    backgroundColor: '#dc2626',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '4px',
    fontSize: '14px',
    cursor: 'pointer',
    marginTop: '12px'
  } as React.CSSProperties,

  // Refresh button
  refreshButton: {
    backgroundColor: '#6b7280',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '4px',
    fontSize: '14px',
    cursor: 'pointer'
  } as React.CSSProperties,

  // Summary section
  summary: {
    backgroundColor: '#f0f9ff',
    padding: '16px',
    borderRadius: '6px',
    border: '1px solid #bae6fd',
    marginBottom: '20px'
  } as React.CSSProperties,

  // Results container
  results: {
    animation: 'fadeIn 0.3s ease-in'
  } as React.CSSProperties,

  // Actions container
  actions: {
    display: 'flex',
    justifyContent: 'center',
    paddingTop: '20px',
    borderTop: '1px solid #e5e7eb'
  } as React.CSSProperties
};

export default RelationshipDebugger;