/**
 * ERD Schema Analyzer Component
 * 
 * Interactive Entity Relationship Diagram visualization that displays
 * database relationships detected from Airtable linked record fields.
 * Provides visual schema exploration and relationship management.
 * 
 * @author GitHub Copilot
 * @version 1.0.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { DatabaseRelationship, RelationshipAnalysisResult, ERDTable, ERDColumn, ERDRelationship } from '../types';
import { importAPI } from '../services/api';
import RelationshipDebugger from './RelationshipDebugger';

interface ERDSchemaAnalyzerProps {
  onAnalysisComplete?: (analysis: RelationshipAnalysisResult) => void;
  height?: number;
  width?: number;
}

/**
 * Main ERD Schema Analyzer component that provides visual database relationship analysis
 * and interactive schema exploration for Airtable-to-PostgreSQL imports.
 */
const ERDSchemaAnalyzer: React.FC<ERDSchemaAnalyzerProps> = ({ 
  onAnalysisComplete, 
  height = 600,
  width = 800 
}) => {
  // State management for analysis and visualization
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<RelationshipAnalysisResult | null>(null);
  const [erdTables, setERDTables] = useState<ERDTable[]>([]);
  const [selectedRelationship, setSelectedRelationship] = useState<DatabaseRelationship | null>(null);
  const [viewMode, setViewMode] = useState<'overview' | 'detailed' | 'sql'>('overview');
  const [error, setError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  
  // Refs for SVG manipulation and drag functionality
  const svgRef = useRef<SVGSVGElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const lastPanOffset = useRef({ x: 0, y: 0 });

  // Add spinner animation CSS on component mount
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      .erd-spinner {
        animation: spin 1s linear infinite;
      }
    `;
    document.head.appendChild(styleElement);

    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  /**
   * Initiates the relationship analysis process by calling the backend API
   * and processing the results for visualization.
   */
  const startAnalysis = async () => {
    try {
      setIsAnalyzing(true);
      setError(null);
      console.log('🔍 Starting ERD relationship analysis...');

      // Call the backend API to analyze relationships
      const result = await importAPI.analyzeRelationships();
      
      console.log('✅ Relationship analysis completed:', result);
      setAnalysisResult(result);
      
      // Convert the relationship data to ERD visualization format
      const erdData = convertToERDFormat(result);
      setERDTables(erdData);
      
      // Notify parent component if callback provided
      if (onAnalysisComplete) {
        onAnalysisComplete(result);
      }
      
    } catch (err: any) {
      console.error('❌ Error during relationship analysis:', err);
      setError(err.response?.data?.error || err.message || 'Unknown error occurred');
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * Converts the relationship analysis result to ERD visualization format
   * with proper table positioning and relationship mapping.
   */
  const convertToERDFormat = (analysis: RelationshipAnalysisResult): ERDTable[] => {
    const { relationships } = analysis.data;
    
    // Extract unique tables from relationships
    const tableNames = new Set<string>();
    relationships.forEach(rel => {
      tableNames.add(rel.sourceTable);
      tableNames.add(rel.targetTable);
    });

    // Create ERD table objects with positioning
    const tables: ERDTable[] = Array.from(tableNames).map((tableName, index) => {
      // Calculate grid-based positioning for tables
      const cols = Math.ceil(Math.sqrt(tableNames.size));
      const row = Math.floor(index / cols);
      const col = index % cols;
      
      const tableWidth = 200;
      const tableHeight = 150;
      const margin = 50;
      
      const x = col * (tableWidth + margin) + margin;
      const y = row * (tableHeight + margin) + margin;

      // Find all relationships involving this table
      const tableRelationships = relationships.filter(rel => 
        rel.sourceTable === tableName || rel.targetTable === tableName
      );

      // Create columns based on relationship analysis
      const columns: ERDColumn[] = [
        {
          name: 'id',
          type: 'SERIAL PRIMARY KEY',
          isPrimaryKey: true,
          isForeignKey: false,
          isRequired: true,
          isUnique: true,
          originalAirtableType: 'primaryKey'
        }
      ];

      // Add foreign key columns from outgoing relationships
      tableRelationships
        .filter(rel => rel.sourceTable === tableName)
        .forEach(rel => {
          columns.push({
            name: rel.sourceColumn,
            type: 'INTEGER',
            isPrimaryKey: false,
            isForeignKey: true,
            isRequired: rel.isRequired,
            isUnique: rel.relationshipType === 'one-to-one',
            originalAirtableType: 'linkedRecord'
          });
        });

      return {
        id: tableName,
        name: tableName,
        displayName: tableName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        position: { x, y },
        columns,
        relationships: tableRelationships.map(rel => ({
          id: `${rel.sourceTable}_${rel.sourceColumn}_${rel.targetTable}`,
          sourceTable: rel.sourceTable,
          sourceColumn: rel.sourceColumn,
          targetTable: rel.targetTable,
          targetColumn: rel.targetColumn,
          relationshipType: rel.relationshipType,
          isRequired: rel.isRequired,
          constraintName: rel.constraintName
        }))
      };
    });

    return tables;
  };

  /**
   * Renders a relationship line between two tables in the ERD diagram
   */
  const renderRelationshipLine = (relationship: DatabaseRelationship, tables: ERDTable[]) => {
    const sourceTable = tables.find(t => t.name === relationship.sourceTable);
    const targetTable = tables.find(t => t.name === relationship.targetTable);
    
    if (!sourceTable || !targetTable) return null;

    // Calculate connection points for the relationship line
    const sourceX = sourceTable.position.x + 100; // Center of table
    const sourceY = sourceTable.position.y + 75;
    const targetX = targetTable.position.x + 100;
    const targetY = targetTable.position.y + 75;

    // Create SVG path for the relationship line
    const pathData = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
    
    // Determine line style based on relationship type
    const getLineStyle = (type: string) => {
      switch (type) {
        case 'one-to-one': return { stroke: '#2563eb', strokeWidth: 2, strokeDasharray: 'none' };
        case 'one-to-many': return { stroke: '#059669', strokeWidth: 2, strokeDasharray: 'none' };
        case 'many-to-one': return { stroke: '#dc2626', strokeWidth: 2, strokeDasharray: 'none' };
        case 'many-to-many': return { stroke: '#7c3aed', strokeWidth: 2, strokeDasharray: '5,5' };
        default: return { stroke: '#6b7280', strokeWidth: 1, strokeDasharray: 'none' };
      }
    };

    const lineStyle = getLineStyle(relationship.relationshipType);

    return (
      <g key={`rel-${relationship.sourceTable}-${relationship.sourceColumn}`}>
        <path
          d={pathData}
          fill="none"
          stroke={lineStyle.stroke}
          strokeWidth={lineStyle.strokeWidth}
          strokeDasharray={lineStyle.strokeDasharray}
          className="relationship-line"
          style={{ cursor: 'pointer' }}
          onClick={() => setSelectedRelationship(relationship)}
        />
        
        {/* Relationship type indicator */}
        <text
          x={(sourceX + targetX) / 2}
          y={(sourceY + targetY) / 2 - 5}
          fill={lineStyle.stroke}
          fontSize="10"
          textAnchor="middle"
          className="relationship-label"
          style={{ cursor: 'pointer' }}
          onClick={() => setSelectedRelationship(relationship)}
        >
          {relationship.relationshipType}
        </text>
        
        {/* Arrow indicators based on relationship type */}
        {relationship.relationshipType === 'one-to-many' && (
          <polygon
            points={`${targetX-5},${targetY-5} ${targetX+5},${targetY} ${targetX-5},${targetY+5}`}
            fill={lineStyle.stroke}
          />
        )}
      </g>
    );
  };

  /**
   * Renders a single table box in the ERD diagram
   */
  const renderTable = (table: ERDTable) => {
    const tableWidth = 200;
    const headerHeight = 30;
    const rowHeight = 20;
    const tableHeight = headerHeight + (table.columns.length * rowHeight) + 10;

    return (
      <g key={table.id} transform={`translate(${table.position.x}, ${table.position.y})`}>
        {/* Table container */}
        <rect
          width={tableWidth}
          height={tableHeight}
          fill="white"
          stroke="#d1d5db"
          strokeWidth="1"
          rx="4"
          className="table-container"
        />
        
        {/* Table header */}
        <rect
          width={tableWidth}
          height={headerHeight}
          fill="#f3f4f6"
          stroke="#d1d5db"
          strokeWidth="1"
          rx="4"
          className="table-header"
        />
        
        <text
          x={tableWidth / 2}
          y={20}
          textAnchor="middle"
          fill="#111827"
          fontSize="14"
          fontWeight="bold"
          className="table-title"
        >
          {table.displayName}
        </text>
        
        {/* Table columns */}
        {table.columns.map((column, index) => (
          <g key={column.name} transform={`translate(0, ${headerHeight + (index * rowHeight)})`}>
            <text
              x={8}
              y={15}
              fill={column.isPrimaryKey ? '#dc2626' : column.isForeignKey ? '#2563eb' : '#374151'}
              fontSize="12"
              className="column-name"
            >
              {column.isPrimaryKey && '🔑 '}
              {column.isForeignKey && '🔗 '}
              {column.name}
            </text>
            <text
              x={tableWidth - 8}
              y={15}
              textAnchor="end"
              fill="#6b7280"
              fontSize="10"
              className="column-type"
            >
              {column.type}
            </text>
          </g>
        ))}
      </g>
    );
  };

  /**
   * Handles mouse wheel events for zooming the ERD diagram
   */
  const handleWheel = (event: React.WheelEvent) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(3, zoomLevel * delta));
    setZoomLevel(newZoom);
  };

  /**
   * Handles mouse down events for starting pan operations
   */
  const handleMouseDown = (event: React.MouseEvent) => {
    isDragging.current = true;
    dragStart.current = { x: event.clientX, y: event.clientY };
    lastPanOffset.current = { ...panOffset };
  };

  /**
   * Handles mouse move events for panning the ERD diagram
   */
  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isDragging.current) return;
    
    const deltaX = event.clientX - dragStart.current.x;
    const deltaY = event.clientY - dragStart.current.y;
    
    setPanOffset({
      x: lastPanOffset.current.x + deltaX,
      y: lastPanOffset.current.y + deltaY
    });
  };

  /**
   * Handles mouse up events for ending pan operations
   */
  const handleMouseUp = () => {
    isDragging.current = false;
  };

  /**
   * Renders the relationship details panel showing information about the selected relationship
   */
  const renderRelationshipDetails = () => {
    if (!selectedRelationship) return null;

    return (
      <div style={styles.relationshipDetails}>
        <h3 style={styles.relationshipTitle}>Relationship Details</h3>
        <div style={styles.relationshipInfo}>
          <p><strong>Source:</strong> {selectedRelationship.sourceTable}.{selectedRelationship.sourceColumn}</p>
          <p><strong>Target:</strong> {selectedRelationship.targetTable}.{selectedRelationship.targetColumn}</p>
          <p><strong>Type:</strong> {selectedRelationship.relationshipType}</p>
          <p><strong>Required:</strong> {selectedRelationship.isRequired ? 'Yes' : 'No'}</p>
          <p><strong>Constraint:</strong> {selectedRelationship.constraintName}</p>
        </div>
        
        {viewMode === 'sql' && (
          <div style={styles.sqlCode}>
            <h4>Generated SQL:</h4>
            <pre style={styles.codeBlock}>{selectedRelationship.sql}</pre>
          </div>
        )}
        
        <button
          onClick={() => setSelectedRelationship(null)}
          style={styles.closeButton}
        >
          Close
        </button>
      </div>
    );
  };

  /**
   * Renders the analysis summary showing statistics about detected relationships
   */
  const renderAnalysisSummary = () => {
    if (!analysisResult) return null;

    const { summary } = analysisResult;
    
    return (
      <div style={styles.analysisSummary}>
        <h3 style={styles.summaryTitle}>Analysis Summary</h3>
        <div style={styles.summaryStats}>
          <div style={styles.stat}>
            <span style={styles.statNumber}>{summary.totalRelationships}</span>
            <span style={styles.statLabel}>Total Relationships</span>
          </div>
          <div style={styles.stat}>
            <span style={styles.statNumber}>{summary.tablesAnalyzed}</span>
            <span style={styles.statLabel}>Tables Analyzed</span>
          </div>
        </div>
        
        <div style={styles.relationshipTypeBreakdown}>
          <h4>Relationship Types:</h4>
          {Object.entries(summary.relationshipTypes).map(([type, count]) => (
            <div key={type} style={styles.typeCount}>
              <span style={styles.typeName}>{type}:</span>
              <span style={styles.typeNumber}>{count}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>ERD Schema Analyzer</h2>
        <p style={styles.description}>
          Interactive Entity Relationship Diagram showing database relationships detected from your Airtable base
        </p>
      </div>

      {/* Relationship Debugger for troubleshooting relationship detection */}
      <RelationshipDebugger 
        initiallyExpanded={false}
        onAnalysisComplete={(debugData) => {
          console.log('🔍 Debug analysis complete:', debugData);
        }}
      />

      <div style={styles.controls}>
        <button
          onClick={startAnalysis}
          disabled={isAnalyzing}
          style={{
            ...styles.analyzeButton,
            ...(isAnalyzing ? styles.analyzeButtonDisabled : {})
          }}
        >
          {isAnalyzing ? '🔍 Analyzing Relationships...' : '🔍 Analyze Relationships'}
        </button>

        {analysisResult && (
          <div style={styles.viewModeControls}>
            <button
              onClick={() => setViewMode('overview')}
              style={{
                ...styles.viewModeButton,
                ...(viewMode === 'overview' ? styles.viewModeButtonActive : {})
              }}
            >
              Overview
            </button>
            <button
              onClick={() => setViewMode('detailed')}
              style={{
                ...styles.viewModeButton,
                ...(viewMode === 'detailed' ? styles.viewModeButtonActive : {})
              }}
            >
              Detailed
            </button>
            <button
              onClick={() => setViewMode('sql')}
              style={{
                ...styles.viewModeButton,
                ...(viewMode === 'sql' ? styles.viewModeButtonActive : {})
              }}
            >
              SQL View
            </button>
          </div>
        )}
      </div>

      {error && (
        <div style={styles.error}>
          <p>❌ {error}</p>
        </div>
      )}

      {analysisResult && (
        <div style={styles.content}>
          <div style={styles.diagramContainer}>
            <svg
              ref={svgRef}
              width={width}
              height={height}
              style={styles.svg}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <g transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoomLevel})`}>
                {/* Render relationship lines first (behind tables) */}
                {analysisResult.data.relationships.map(relationship =>
                  renderRelationshipLine(relationship, erdTables)
                )}
                
                {/* Render tables on top of relationship lines */}
                {erdTables.map(table => renderTable(table))}
              </g>
            </svg>
            
            <div style={styles.zoomControls}>
              <button onClick={() => setZoomLevel(z => Math.min(3, z * 1.2))} style={styles.zoomButton}>+</button>
              <span style={styles.zoomLevel}>{Math.round(zoomLevel * 100)}%</span>
              <button onClick={() => setZoomLevel(z => Math.max(0.1, z * 0.8))} style={styles.zoomButton}>-</button>
            </div>
          </div>

          <div style={styles.sidebar}>
            {renderAnalysisSummary()}
            {selectedRelationship && renderRelationshipDetails()}
          </div>
        </div>
      )}

      {isAnalyzing && (
        <div style={styles.loadingOverlay}>
          <div style={styles.loadingSpinner}>
            <div style={styles.spinner} className="erd-spinner"></div>
            <p>Analyzing database relationships...</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Comprehensive styling for the ERD Schema Analyzer component
const styles = {
  // Main container styling with responsive layout
  container: {
    padding: '20px',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    maxWidth: '1400px',
    margin: '0 auto'
  } as React.CSSProperties,

  // Header section with title and description
  header: {
    marginBottom: '20px',
    textAlign: 'center' as const
  } as React.CSSProperties,

  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: '8px'
  } as React.CSSProperties,

  description: {
    color: '#6b7280',
    fontSize: '14px',
    marginBottom: '0'
  } as React.CSSProperties,

  // Control buttons and mode selection
  controls: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    flexWrap: 'wrap' as const,
    gap: '10px'
  } as React.CSSProperties,

  analyzeButton: {
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s'
  } as React.CSSProperties,

  analyzeButtonDisabled: {
    backgroundColor: '#9ca3af',
    cursor: 'not-allowed'
  } as React.CSSProperties,

  viewModeControls: {
    display: 'flex',
    gap: '8px'
  } as React.CSSProperties,

  viewModeButton: {
    backgroundColor: 'white',
    color: '#374151',
    border: '1px solid #d1d5db',
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    transition: 'all 0.2s'
  } as React.CSSProperties,

  viewModeButtonActive: {
    backgroundColor: '#2563eb',
    color: 'white',
    borderColor: '#2563eb'
  } as React.CSSProperties,

  // Error display styling
  error: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    padding: '12px',
    marginBottom: '20px',
    color: '#dc2626'
  } as React.CSSProperties,

  // Main content area with diagram and sidebar
  content: {
    display: 'flex',
    gap: '20px',
    height: '600px'
  } as React.CSSProperties,

  diagramContainer: {
    flex: '1',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    overflow: 'hidden',
    position: 'relative' as const,
    backgroundColor: '#f9fafb'
  } as React.CSSProperties,

  svg: {
    width: '100%',
    height: '100%',
    cursor: 'move'
  } as React.CSSProperties,

  // Zoom controls positioned over the diagram
  zoomControls: {
    position: 'absolute' as const,
    top: '10px',
    right: '10px',
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'white',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    padding: '4px'
  } as React.CSSProperties,

  zoomButton: {
    backgroundColor: 'transparent',
    border: 'none',
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold'
  } as React.CSSProperties,

  zoomLevel: {
    fontSize: '12px',
    padding: '0 8px',
    color: '#6b7280'
  } as React.CSSProperties,

  // Sidebar for analysis summary and relationship details
  sidebar: {
    width: '300px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px'
  } as React.CSSProperties,

  // Analysis summary panel styling
  analysisSummary: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    padding: '16px'
  } as React.CSSProperties,

  summaryTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: '12px'
  } as React.CSSProperties,

  summaryStats: {
    display: 'flex',
    gap: '16px',
    marginBottom: '16px'
  } as React.CSSProperties,

  stat: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center'
  } as React.CSSProperties,

  statNumber: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#2563eb'
  } as React.CSSProperties,

  statLabel: {
    fontSize: '12px',
    color: '#6b7280'
  } as React.CSSProperties,

  relationshipTypeBreakdown: {
    borderTop: '1px solid #e5e7eb',
    paddingTop: '12px'
  } as React.CSSProperties,

  typeCount: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 0'
  } as React.CSSProperties,

  typeName: {
    fontSize: '12px',
    color: '#374151'
  } as React.CSSProperties,

  typeNumber: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#111827'
  } as React.CSSProperties,

  // Relationship details panel styling
  relationshipDetails: {
    backgroundColor: '#ffffff',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    padding: '16px'
  } as React.CSSProperties,

  relationshipTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: '12px'
  } as React.CSSProperties,

  relationshipInfo: {
    marginBottom: '12px'
  } as React.CSSProperties,

  sqlCode: {
    marginBottom: '12px'
  } as React.CSSProperties,

  codeBlock: {
    backgroundColor: '#f3f4f6',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    padding: '8px',
    fontSize: '12px',
    fontFamily: 'monospace',
    overflow: 'auto',
    whiteSpace: 'pre-wrap' as const
  } as React.CSSProperties,

  closeButton: {
    backgroundColor: '#6b7280',
    color: 'white',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
  } as React.CSSProperties,

  // Loading overlay for analysis progress
  loadingOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  } as React.CSSProperties,

  loadingSpinner: {
    backgroundColor: 'white',
    padding: '40px',
    borderRadius: '8px',
    textAlign: 'center' as const,
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
  } as React.CSSProperties,

  // CSS animation for loading spinner - using CSS keyframes
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e5e7eb',
    borderTop: '4px solid #2563eb',
    borderRadius: '50%',
    margin: '0 auto 16px',
    // CSS animation will be added via a style tag
  } as React.CSSProperties
};

export default ERDSchemaAnalyzer;