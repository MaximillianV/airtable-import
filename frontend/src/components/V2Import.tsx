/**
 * V2 Import Component
 * 
 * New type-aware import workflow with:
 * - Table selection
 * - Progress tracking through phases
 * - Relationship analysis results
 * - Manual approval workflow
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { v2ImportAPI } from '../services/api';

interface ImportSession {
  sessionId: string;
  phase: 'schema-created' | 'data-imported' | 'relationships-analyzed' | 'completed';
  tablesProcessed?: number;
  tablesCreated?: number;
  tablesImported?: number;
  totalRecords?: number;
  results?: ImportResult[];
}

interface ImportResult {
  tableName: string;
  status: 'completed' | 'error';
  recordsImported?: number;
  error?: string;
}

interface RelationshipProposal {
  fromTable: string;
  fromField: string;
  toTable: string;
  toField: string;
  confidence: number;
  relationshipType: string;
  reasoning: string;
}

const V2Import: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [currentSession, setCurrentSession] = useState<ImportSession | null>(null);
  const [phase, setPhase] = useState<'select' | 'phase1' | 'phase2' | 'phase3' | 'completed'>('select');
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [availableTables, setAvailableTables] = useState<string[]>([]);
  const [relationshipProposals, setRelationshipProposals] = useState<RelationshipProposal[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAvailableTables();
  }, []);

  const loadAvailableTables = async () => {
    try {
      setLoading(true);
      console.log('🔍 Discovering tables from Airtable...');
      
      const response = await v2ImportAPI.discoverTables();
      
      if (response.success && response.tables) {
        const tableNames = response.tables.map((table: any) => table.name);
        setAvailableTables(tableNames);
        console.log(`✅ Found ${tableNames.length} tables:`, tableNames);
      } else {
        throw new Error(response.error || 'Failed to discover tables');
      }
    } catch (error: any) {
      console.error('❌ Table discovery failed:', error);
      setError(`Failed to load tables: ${error.response?.data?.error || error.message}`);
      
      // Fallback to common table names if discovery fails
      const fallbackTables = [
        'Contacts', 'Companies', 'Deals', 'Products', 'Invoices', 
        'Subscriptions', 'Addresses', 'Tickets', 'Orders'
      ];
      setAvailableTables(fallbackTables);
    } finally {
      setLoading(false);
    }
  };

  const startPhase1 = async () => {
    try {
      setLoading(true);
      setError(null);
      setPhase('phase1');

      console.log('🚀 Starting V2 Phase 1 with tables:', selectedTables);

      const response = await v2ImportAPI.phase1CreateSchema({
        selectedTables: selectedTables.length > 0 ? selectedTables : null
      });

      if (response.success) {
        setCurrentSession({
          sessionId: response.sessionId,
          phase: 'schema-created',
          tablesProcessed: response.tablesProcessed,
          tablesCreated: response.tablesCreated
        });
        setPhase('phase2');
        console.log('✅ Phase 1 complete:', response);
      } else {
        throw new Error(response.error || 'Phase 1 failed');
      }
    } catch (error: any) {
      console.error('❌ Phase 1 failed:', error);
      setError(`Phase 1 failed: ${error.response?.data?.error || error.message}`);
      setPhase('select');
    } finally {
      setLoading(false);
    }
  };

  const startPhase2 = async () => {
    if (!currentSession?.sessionId) return;

    try {
      setLoading(true);
      setError(null);

      console.log('📥 Starting V2 Phase 2 for session:', currentSession.sessionId);

      const response = await v2ImportAPI.phase2ImportData({
        sessionId: currentSession.sessionId
      });

      if (response.success) {
        setCurrentSession(prev => prev ? {
          ...prev,
          phase: 'data-imported',
          tablesImported: response.tablesImported,
          totalRecords: response.totalRecords,
          results: response.results
        } : null);
        setPhase('phase3');
        console.log('✅ Phase 2 complete:', response);
      } else {
        throw new Error(response.error || 'Phase 2 failed');
      }
    } catch (error: any) {
      console.error('❌ Phase 2 failed:', error);
      setError(`Phase 2 failed: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const startPhase3 = async () => {
    if (!currentSession?.sessionId) return;

    try {
      setLoading(true);
      setError(null);

      console.log('🔗 Starting V2 Phase 3 relationship analysis for session:', currentSession.sessionId);

      const response = await v2ImportAPI.analyzeRelationships({
        sessionId: currentSession.sessionId
      });

      if (response.success) {
        setRelationshipProposals(response.proposalReport || []);
        setCurrentSession(prev => prev ? {
          ...prev,
          phase: 'relationships-analyzed'
        } : null);
        setPhase('completed');
        console.log('✅ Phase 3 complete:', response);
      } else {
        // Even if relationship analysis fails, we can still show success
        console.warn('⚠️ Phase 3 warning:', response.error);
        setPhase('completed');
      }
    } catch (error: any) {
      console.error('⚠️ Phase 3 warning:', error);
      // Don't treat this as a failure - relationship analysis is optional
      setPhase('completed');
    } finally {
      setLoading(false);
    }
  };

  const resetImport = () => {
    setCurrentSession(null);
    setPhase('select');
    setSelectedTables([]);
    setRelationshipProposals([]);
    setError(null);
  };

  const styles = {
    container: {
      padding: '20px',
      maxWidth: '1200px',
      margin: '0 auto'
    },
    header: {
      textAlign: 'center' as const,
      marginBottom: '30px'
    },
    phaseContainer: {
      backgroundColor: '#f8fafc',
      padding: '20px',
      borderRadius: '8px',
      marginBottom: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    },
    phaseTitle: {
      color: '#1e40af',
      marginBottom: '15px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px'
    },
    button: {
      backgroundColor: '#3b82f6',
      color: 'white',
      border: 'none',
      padding: '12px 24px',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '16px',
      fontWeight: '500',
      transition: 'background-color 0.2s'
    },
    buttonDisabled: {
      backgroundColor: '#9ca3af',
      cursor: 'not-allowed'
    },
    tableGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '10px',
      marginBottom: '20px'
    },
    tableOption: {
      padding: '10px',
      border: '2px solid #e5e7eb',
      borderRadius: '6px',
      cursor: 'pointer',
      transition: 'all 0.2s'
    },
    tableOptionSelected: {
      borderColor: '#3b82f6',
      backgroundColor: '#eff6ff'
    },
    progressStats: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
      gap: '15px',
      marginBottom: '20px'
    },
    statCard: {
      backgroundColor: 'white',
      padding: '15px',
      borderRadius: '6px',
      textAlign: 'center' as const,
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    },
    statNumber: {
      fontSize: '24px',
      fontWeight: 'bold',
      color: '#059669'
    },
    statLabel: {
      fontSize: '14px',
      color: '#6b7280',
      marginTop: '5px'
    },
    resultsTable: {
      width: '100%',
      borderCollapse: 'collapse' as const,
      backgroundColor: 'white',
      borderRadius: '6px',
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    },
    tableHeader: {
      backgroundColor: '#f3f4f6',
      padding: '12px',
      textAlign: 'left' as const,
      fontWeight: '600'
    },
    tableCell: {
      padding: '12px',
      borderTop: '1px solid #e5e7eb'
    },
    successIcon: {
      color: '#059669'
    },
    errorIcon: {
      color: '#dc2626'
    },
    error: {
      backgroundColor: '#fef2f2',
      color: '#dc2626',
      padding: '15px',
      borderRadius: '6px',
      marginBottom: '20px',
      border: '1px solid #fecaca'
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>V2 Type-Aware Import System</h1>
        <p>Enhanced import with proper field type mapping and relationship analysis</p>
      </div>

      {error && (
        <div style={styles.error}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {phase === 'select' && (
        <div style={styles.phaseContainer}>
          <h3 style={styles.phaseTitle}>
            📋 Select Tables to Import
          </h3>
          <p>Choose which tables to import, or leave empty to import all available tables:</p>
          
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{ fontSize: '24px', marginBottom: '10px' }}>🔍</div>
              <p>Discovering tables from your Airtable base...</p>
            </div>
          ) : (
            <div style={styles.tableGrid}>
              {availableTables.map(table => (
              <div
                key={table}
                style={{
                  ...styles.tableOption,
                  ...(selectedTables.includes(table) ? styles.tableOptionSelected : {})
                }}
                onClick={() => {
                  setSelectedTables(prev => 
                    prev.includes(table) 
                      ? prev.filter(t => t !== table)
                      : [...prev, table]
                  );
                }}
              >
                {table}
              </div>
            ))}
            </div>
          )}

          {!loading && (
            <>
              <p style={{ marginBottom: '20px', color: '#6b7280' }}>
                Selected: {selectedTables.length > 0 ? selectedTables.join(', ') : 'All tables'}
              </p>

              <button
                style={styles.button}
                onClick={startPhase1}
                disabled={loading}
              >
                {loading ? '🔄 Starting...' : '🚀 Start V2 Import'}
              </button>
            </>
          )}
        </div>
      )}

      {phase === 'phase1' && (
        <div style={styles.phaseContainer}>
          <h3 style={styles.phaseTitle}>
            🏗️ Phase 1: Creating Type-Aware Schema
          </h3>
          <p>Creating database tables with proper field type mapping...</p>
          {loading && <p>⏳ Please wait, analyzing Airtable schema and creating tables...</p>}
        </div>
      )}

      {phase === 'phase2' && currentSession && (
        <div style={styles.phaseContainer}>
          <h3 style={styles.phaseTitle}>
            ✅ Phase 1 Complete
          </h3>
          
          <div style={styles.progressStats}>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>{currentSession.tablesProcessed}</div>
              <div style={styles.statLabel}>Tables Processed</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>{currentSession.tablesCreated}</div>
              <div style={styles.statLabel}>Tables Created</div>
            </div>
          </div>

          <h3 style={styles.phaseTitle}>
            📥 Phase 2: Import Data
          </h3>
          <p>Ready to import data with proper type transformations.</p>
          
          <button
            style={{
              ...styles.button,
              ...(loading ? styles.buttonDisabled : {})
            }}
            onClick={startPhase2}
            disabled={loading}
          >
            {loading ? '🔄 Importing Data...' : '📥 Start Data Import'}
          </button>
        </div>
      )}

      {phase === 'phase3' && currentSession && (
        <div style={styles.phaseContainer}>
          <h3 style={styles.phaseTitle}>
            ✅ Phase 2 Complete
          </h3>
          
          <div style={styles.progressStats}>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>{currentSession.tablesImported}</div>
              <div style={styles.statLabel}>Tables Imported</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>{currentSession.totalRecords?.toLocaleString()}</div>
              <div style={styles.statLabel}>Records Imported</div>
            </div>
          </div>

          {currentSession.results && (
            <div>
              <h4>Import Results:</h4>
              <table style={styles.resultsTable}>
                <thead>
                  <tr>
                    <th style={styles.tableHeader}>Table</th>
                    <th style={styles.tableHeader}>Status</th>
                    <th style={styles.tableHeader}>Records</th>
                  </tr>
                </thead>
                <tbody>
                  {currentSession.results.map((result, index) => (
                    <tr key={index}>
                      <td style={styles.tableCell}>{result.tableName}</td>
                      <td style={styles.tableCell}>
                        {result.status === 'completed' ? (
                          <span style={styles.successIcon}>✅ Success</span>
                        ) : (
                          <span style={styles.errorIcon}>❌ Error</span>
                        )}
                      </td>
                      <td style={styles.tableCell}>
                        {result.recordsImported?.toLocaleString() || result.error}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h3 style={styles.phaseTitle}>
            🔗 Phase 3: Analyze Relationships
          </h3>
          <p>Analyze relationships between tables for referential integrity.</p>
          
          <button
            style={{
              ...styles.button,
              ...(loading ? styles.buttonDisabled : {})
            }}
            onClick={startPhase3}
            disabled={loading}
          >
            {loading ? '🔄 Analyzing...' : '🔗 Analyze Relationships'}
          </button>
        </div>
      )}

      {phase === 'completed' && currentSession && (
        <div style={styles.phaseContainer}>
          <h3 style={styles.phaseTitle}>
            🎉 V2 Import Complete!
          </h3>
          
          <div style={styles.progressStats}>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>{currentSession.tablesImported}</div>
              <div style={styles.statLabel}>Tables Imported</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>{currentSession.totalRecords?.toLocaleString()}</div>
              <div style={styles.statLabel}>Records Imported</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>{relationshipProposals.length}</div>
              <div style={styles.statLabel}>Relationships Found</div>
            </div>
          </div>

          {relationshipProposals.length > 0 && (
            <div>
              <h4>Relationship Analysis Results:</h4>
              <table style={styles.resultsTable}>
                <thead>
                  <tr>
                    <th style={styles.tableHeader}>From</th>
                    <th style={styles.tableHeader}>To</th>
                    <th style={styles.tableHeader}>Type</th>
                    <th style={styles.tableHeader}>Confidence</th>
                    <th style={styles.tableHeader}>Reasoning</th>
                  </tr>
                </thead>
                <tbody>
                  {relationshipProposals.slice(0, 10).map((proposal, index) => (
                    <tr key={index}>
                      <td style={styles.tableCell}>{proposal.fromTable}.{proposal.fromField}</td>
                      <td style={styles.tableCell}>{proposal.toTable}.{proposal.toField}</td>
                      <td style={styles.tableCell}>{proposal.relationshipType}</td>
                      <td style={styles.tableCell}>{(proposal.confidence * 100).toFixed(1)}%</td>
                      <td style={styles.tableCell}>{proposal.reasoning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ marginTop: '30px' }}>
            <button
              style={styles.button}
              onClick={resetImport}
            >
              🔄 Start New Import
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default V2Import;