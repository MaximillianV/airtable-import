/**
 * Enhanced Relationship Wizard Component
 * 
 * This enhanced version integrates data-driven relationship detection with user confirmation.
 * Features 70%+ confidence auto-suggestions, manual overrides, and comprehensive FK management.
 * Always asks user for confirmation but provides intelligent autofill suggestions.
 */

import React, { useState, useEffect } from 'react';
import { importAPI } from '../services/api';
import { socketService } from '../services/socket';

interface DataPattern {
  confidence: number;
  type: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  reasoning: string;
  sourceTable: string;
  sourceField: string;
  targetTable: string;
  recommendation: 'auto-suggest' | 'manual-review';
  suggestedForeignKey: {
    foreignKeyTable: string;
    foreignKeyColumn: string;
    referencesTable: string;
    junctionTable?: any;
  };
}

interface EnhancedRelationshipWizardProps {
  tables: any[];
  onConfigurationComplete: (config: any) => void;
  onCancel: () => void;
}

/**
 * Enhanced Relationship Wizard with data-driven detection and user confirmation.
 * Provides intelligent auto-suggestions with confidence levels while always asking
 * user for final confirmation. Implements TQDM-style progress tracking.
 */
const EnhancedRelationshipWizard: React.FC<EnhancedRelationshipWizardProps> = ({
  tables,
  onConfigurationComplete,
  onCancel
}) => {
  // State management for wizard steps and data
  const [currentStep, setCurrentStep] = useState(0); // Start with confirmation step
  const [loading, setLoading] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [dataPatterns, setDataPatterns] = useState<DataPattern[]>([]);
  const [userConfirmations, setUserConfirmations] = useState<Record<string, any>>({});
  const [importConfirmed, setImportConfirmed] = useState(false);
  const [finalConfiguration, setFinalConfiguration] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Analysis and configuration states
  const [highConfidencePatterns, setHighConfidencePatterns] = useState<DataPattern[]>([]);
  const [lowConfidencePatterns, setLowConfidencePatterns] = useState<DataPattern[]>([]);
  const [autoSuggestions, setAutoSuggestions] = useState<DataPattern[]>([]);

  // Console logging state
  const [analysisLogs, setAnalysisLogs] = useState<string[]>([]);
  const [analysisComplete, setAnalysisComplete] = useState(false);

  /**
   * Step 1: Analyze data patterns using statistical analysis.
   * Performs intelligent relationship detection with confidence scoring.
   */
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    // Add new logs at the beginning to show newest on top
    setAnalysisLogs(prev => [`[${timestamp}] ${message}`, ...prev]);
  };

  const startFullImportWorkflow = async () => {
    setLoading(true);
    setAnalysisProgress(0);
    setAnalysisComplete(false);
    setError(null);
    setAnalysisLogs([]);

    // Set up Socket.IO listener for real-time progress updates
    let progressUnsubscribe: (() => void) | null = null;

    try {
      addLog('🚀 Initializing analysis session with real-time progress...');

      // Subscribe to import-progress events for real-time backend updates
      progressUnsubscribe = socketService.onProgressUpdate((progressData: any) => {
        // Real backend progress updates
        if (progressData.message) {
          addLog(progressData.message);
        }
        
        // Update progress bar based on new workflow stages
        const progressStages: Record<string, number> = {
          // Stage 1: Confirmation and Setup (0-5%)
          'confirming': 2,
          'connecting': 5,
          
          // Stage 2: Schema Discovery (5-15%)
          'schema-discovery': 8,
          'schema-analysis': 12,
          'schema-complete': 15,
          
          // Stage 3: Database Creation (15-30%)
          'creating-tables': 18,
          'creating-enums': 22,
          'database-ready': 30,
          
          // Stage 4: Data Import (30-70%) - 40% of total workflow
          'import-starting': 32,
          'importing-data': (progressData.importProgress || 0) * 0.38 + 32, // Scale table progress to 32-70%
          'import-complete': 70,
          
          // Stage 5: Relationship Analysis (70-85%)
          'analyzing-relationships': 72,
          'pattern-analysis': 78,
          'pattern-complete': 85,
          
          // Stage 6: Schema Enhancement (85-95%)
          'creating-foreign-keys': 88,
          'creating-junction-tables': 92,
          'schema-enhanced': 95,
          
          // Stage 7: Completion (95-100%)
          'finalizing': 98,
          'completed': 100
        };
        
        const newProgress = progressStages[progressData.status];
        if (newProgress !== undefined) {
          setAnalysisProgress(Math.min(newProgress, 100));
        }
      });

      // Call the new full import workflow endpoint (create DB, import all data, analyze relationships)
      const response = await importAPI.startFullImportWorkflow();
      
      addLog('✅ API call completed, processing results...');
      setAnalysisProgress(98);

      if (response.success) {
        const patterns = response.data.relationships || [];
        const recommendations = response.data.recommendations || {};
        const analysis = response.data.analysis || {};

        addLog(`📈 Results: ${patterns.length} total relationships detected`);
        addLog(`   • High confidence (≥70%): ${analysis.highConfidenceCount || 0}`);
        addLog(`   • Low confidence (<70%): ${analysis.lowConfidenceCount || 0}`);
        addLog(`   • Data enhanced: ${analysis.dataEnhancedCount || 0}`);
        addLog(`   • Schema only: ${analysis.schemaBasedCount - analysis.dataEnhancedCount || 0}`);

        setDataPatterns(patterns);
        setHighConfidencePatterns(recommendations.highConfidence || []);
        setLowConfidencePatterns(recommendations.lowConfidence || []);
        setAutoSuggestions(recommendations.autoSuggestions || []);

        // Initialize user confirmations with auto-suggestions for high confidence patterns
        const initialConfirmations: Record<string, any> = {};
        patterns.forEach((pattern: DataPattern) => {
          const patternKey = `${pattern.sourceTable}.${pattern.sourceField}->${pattern.targetTable}`;
          initialConfirmations[patternKey] = {
            relationshipType: pattern.confidence >= 0.7 ? pattern.type : 'manual-review',
            confidence: pattern.confidence,
            autoSuggested: pattern.confidence >= 0.7,
            userConfirmed: false,
            foreignKeyPlacement: pattern.suggestedForeignKey,
            reasoning: pattern.reasoning
          };
        });

        setUserConfirmations(initialConfirmations);
        setAnalysisProgress(100);
        addLog('🎉 Analysis complete! Ready for user review.');
        setAnalysisComplete(true);
        
        // Auto-advance to next step after a short delay
        setTimeout(() => {
          setCurrentStep(2);
        }, 1500);

        console.log(`Analysis complete: ${patterns.length} relationships detected`);
      } else {
        throw new Error(response.error || 'Analysis failed');
      }
    } catch (error) {
      console.error('Data pattern analysis failed:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      addLog(`❌ Analysis failed: ${errorMsg}`);
      setError(`Analysis failed: ${errorMsg}`);
    } finally {
      // Clean up Socket.IO subscription
      if (progressUnsubscribe) {
        progressUnsubscribe();
      }
      setLoading(false);
    }
  };

  /**
   * Step 2: User confirmation and manual override interface.
   * Always asks user but provides autofill for 70%+ confidence patterns.
   */
  const renderConfirmationStep = () => {
    return (
      <div style={styles.stepContainer}>
        <div style={styles.stepHeader}>
          <h2>Relationship Configuration - Step 2 of 3</h2>
          <p>Review and confirm relationship suggestions. High-confidence suggestions are pre-filled but require your confirmation.</p>
        </div>

        {/* High Confidence Suggestions */}
        {highConfidencePatterns.length > 0 && (
          <div style={styles.sectionContainer}>
            <h3 style={styles.sectionTitle}>
              High Confidence Suggestions (≥70%) - Auto-filled
            </h3>
            <p style={styles.sectionDescription}>
              These relationships have high confidence scores and are pre-filled for your convenience. Please review and confirm.
            </p>
            {renderRelationshipList(highConfidencePatterns, true)}
          </div>
        )}

        {/* Low Confidence Patterns - Manual Review */}
        {lowConfidencePatterns.length > 0 && (
          <div style={styles.sectionContainer}>
            <h3 style={styles.sectionTitle}>
              Manual Review Required (&lt;70% confidence)
            </h3>
            <p style={styles.sectionDescription}>
              These relationships require manual configuration due to lower confidence scores.
            </p>
            {renderRelationshipList(lowConfidencePatterns, false)}
          </div>
        )}

        {/* Summary Statistics */}
        <div style={styles.summaryContainer}>
          <div style={styles.summaryItem}>
            <strong>Total Relationships:</strong> {dataPatterns.length}
          </div>
          <div style={styles.summaryItem}>
            <strong>High Confidence:</strong> {highConfidencePatterns.length}
          </div>
          <div style={styles.summaryItem}>
            <strong>Manual Review:</strong> {lowConfidencePatterns.length}
          </div>
          <div style={styles.summaryItem}>
            <strong>Confirmed:</strong> {Object.values(userConfirmations).filter(c => c.userConfirmed).length}
          </div>
        </div>

        {/* Step Navigation */}
        <div style={styles.stepNavigation}>
          <button
            onClick={() => setCurrentStep(1)}
            style={styles.secondaryButton}
          >
            ← Back to Analysis
          </button>
          <button
            onClick={generateFinalConfiguration}
            style={styles.primaryButton}
            disabled={Object.values(userConfirmations).filter(c => c.userConfirmed).length === 0}
          >
            Generate Configuration →
          </button>
        </div>
      </div>
    );
  };

  /**
   * Renders a list of relationships with confirmation controls.
   * Shows confidence levels, reasoning, and FK placement suggestions.
   */
  const renderRelationshipList = (patterns: DataPattern[], isHighConfidence: boolean) => {
    return patterns.map((pattern) => {
      const patternKey = `${pattern.sourceTable}.${pattern.sourceField}->${pattern.targetTable}`;
      const confirmation = userConfirmations[patternKey] || {};

      return (
        <div key={patternKey} style={styles.relationshipCard}>
          {/* Relationship Header */}
          <div style={styles.relationshipHeader}>
            <div style={styles.relationshipTitle}>
              <strong>{pattern.sourceTable}.{pattern.sourceField}</strong>
              <span style={styles.arrow}>→</span>
              <strong>{pattern.targetTable}</strong>
            </div>
            <div style={styles.confidenceBadge}>
              <span style={styles.confidenceLabel}>Confidence:</span>
              <span style={{
                ...styles.confidenceValue,
                color: pattern.confidence >= 0.7 ? '#10b981' : '#f59e0b'
              }}>
                {(pattern.confidence * 100).toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Reasoning */}
          <div style={styles.reasoningText}>
            <strong>Analysis:</strong> {pattern.reasoning}
          </div>

          {/* Relationship Type Selection */}
          <div style={styles.configurationRow}>
            <label style={styles.configurationLabel}>Relationship Type:</label>
            <select
              value={confirmation.relationshipType || pattern.type}
              onChange={(e) => updateConfirmation(patternKey, 'relationshipType', e.target.value)}
              style={styles.select}
            >
              <option value="one-to-one">One-to-One</option>
              <option value="one-to-many">One-to-Many</option>
              <option value="many-to-one">Many-to-One</option>
              <option value="many-to-many">Many-to-Many</option>
              <option value="remove">Remove Relationship</option>
            </select>
          </div>

          {/* Foreign Key Placement Info */}
          {confirmation.relationshipType !== 'remove' && (
            <div style={styles.foreignKeyInfo}>
              <strong>Foreign Key Placement:</strong>
              {pattern.suggestedForeignKey?.junctionTable ? (
                <span> Junction table: {pattern.suggestedForeignKey.junctionTable.name}</span>
              ) : pattern.suggestedForeignKey ? (
                <span> {pattern.suggestedForeignKey.foreignKeyTable}.{pattern.suggestedForeignKey.foreignKeyColumn} → {pattern.suggestedForeignKey.referencesTable}</span>
              ) : (
                <span> Auto-generated based on relationship type</span>
              )}
            </div>
          )}

          {/* User Confirmation Checkbox */}
          <div style={styles.confirmationRow}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={confirmation.userConfirmed || false}
                onChange={(e) => updateConfirmation(patternKey, 'userConfirmed', e.target.checked)}
                style={styles.checkbox}
              />
              {isHighConfidence ? 
                'Confirm this auto-suggested relationship' : 
                'Confirm this manually configured relationship'
              }
            </label>
          </div>

          {/* Auto-suggestion indicator */}
          {confirmation.autoSuggested && (
            <div style={styles.autoSuggestedBadge}>
              ✨ Auto-suggested (High Confidence)
            </div>
          )}
        </div>
      );
    });
  };

  /**
   * Updates user confirmation for a specific relationship pattern.
   */
  const updateConfirmation = (patternKey: string, field: string, value: any) => {
    setUserConfirmations(prev => ({
      ...prev,
      [patternKey]: {
        ...prev[patternKey],
        [field]: value
      }
    }));
  };

  /**
   * Step 3: Generate final configuration with user confirmations.
   * Creates comprehensive schema configuration for import process.
   */
  const generateFinalConfiguration = async () => {
    setLoading(true);
    try {
      console.log('Generating final schema configuration...');

      // Build configuration from user confirmations
      const relationshipOverrides: Record<string, any> = {};
      const fieldTypeOverrides: Record<string, any> = {};
      const foreignKeyPlacements: any[] = [];

      Object.entries(userConfirmations).forEach(([patternKey, confirmation]) => {
        if (confirmation.userConfirmed && confirmation.relationshipType !== 'remove') {
          const [sourceRef, targetTable] = patternKey.split('->');
          const [sourceTable, sourceField] = sourceRef.split('.');

          // Add relationship override
          const relationshipId = `${sourceTable}_${sourceField}_${targetTable}`;
          relationshipOverrides[relationshipId] = {
            type: confirmation.relationshipType,
            sourceTable,
            sourceField,
            targetTable,
            confidence: confirmation.confidence,
            userConfirmed: true
          };

          // Add FK placement
          if (confirmation.foreignKeyPlacement) {
            foreignKeyPlacements.push({
              ...confirmation.foreignKeyPlacement,
              relationshipId
            });
          }
        }
      });

      const configuration = {
        relationshipDetection: {
          useDataDrivenAnalysis: true,
          confidenceThreshold: 0.7,
          userConfirmationsRequired: true
        },
        relationshipOverrides,
        fieldTypeOverrides,
        foreignKeyPlacements,
        schemaGeneration: {
          createEnums: true,
          createReferenceTables: true,
          createJunctionTables: true,
          createViews: true,
          createIndexes: true
        },
        metadata: {
          analysisTimestamp: new Date().toISOString(),
          totalRelationshipsAnalyzed: dataPatterns.length,
          userConfirmedRelationships: Object.keys(relationshipOverrides).length,
          highConfidenceCount: highConfidencePatterns.length,
          lowConfidenceCount: lowConfidencePatterns.length
        }
      };

      setFinalConfiguration(configuration);
      setCurrentStep(3);
      console.log('Final configuration generated:', configuration);
    } catch (error) {
      console.error('Configuration generation failed:', error);
      setError(`Configuration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Step 3: Preview and finalize configuration.
   */
  const renderConfigurationPreview = () => {
    if (!finalConfiguration) return null;

    const confirmedRelationships = Object.keys(finalConfiguration.relationshipOverrides).length;
    const foreignKeys = finalConfiguration.foreignKeyPlacements.length;

    return (
      <div style={styles.stepContainer}>
        <div style={styles.stepHeader}>
          <h2>Configuration Preview - Step 3 of 3</h2>
          <p>Review your final schema configuration before applying to the import process.</p>
        </div>

        {/* Configuration Summary */}
        <div style={styles.configurationSummary}>
          <h3>Configuration Summary</h3>
          <div style={styles.summaryGrid}>
            <div style={styles.summaryCard}>
              <div style={styles.summaryNumber}>{confirmedRelationships}</div>
              <div style={styles.summaryLabel}>Confirmed Relationships</div>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.summaryNumber}>{foreignKeys}</div>
              <div style={styles.summaryLabel}>Foreign Key Constraints</div>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.summaryNumber}>{highConfidencePatterns.length}</div>
              <div style={styles.summaryLabel}>High Confidence Detected</div>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.summaryNumber}>{(highConfidencePatterns.length / dataPatterns.length * 100).toFixed(0)}%</div>
              <div style={styles.summaryLabel}>Auto-suggestion Accuracy</div>
            </div>
          </div>
        </div>

        {/* Relationship Details */}
        <div style={styles.relationshipDetails}>
          <h3>Confirmed Relationships</h3>
          {Object.entries(finalConfiguration.relationshipOverrides).map(([id, relationship]: [string, any]) => (
            <div key={id} style={styles.relationshipDetailCard}>
              <div style={styles.relationshipDetailHeader}>
                <strong>{relationship.sourceTable}.{relationship.sourceField}</strong>
                <span style={styles.arrow}>→</span>
                <strong>{relationship.targetTable}</strong>
                <span style={styles.relationshipType}>{relationship.type}</span>
              </div>
              <div style={styles.relationshipDetailInfo}>
                Confidence: {(relationship.confidence * 100).toFixed(1)}% | 
                User Confirmed: ✅ | 
                Type: {relationship.type}
              </div>
            </div>
          ))}
        </div>

        {/* Final Actions */}
        <div style={styles.finalActions}>
          <button
            onClick={() => setCurrentStep(2)}
            style={styles.secondaryButton}
          >
            ← Back to Configuration
          </button>
          <button
            onClick={() => onConfigurationComplete(finalConfiguration)}
            style={styles.primaryButton}
            disabled={confirmedRelationships === 0}
          >
            Apply Configuration & Start Import
          </button>
        </div>
      </div>
    );
  };

  /**
   * Step 0: Import confirmation step - warns user about full data import.
   * Explains the new workflow and gets user confirmation before proceeding.
   */
  const renderImportConfirmationStep = () => {
    return (
      <div style={styles.stepContainer}>
        <div style={styles.stepHeader}>
          <h2>Import Confirmation - Step 0 of 3</h2>
          <p>You are about to start the full Airtable import process. Please review the workflow below.</p>
        </div>

        <div style={styles.workflowExplanation}>
          <h3>📋 Complete Import Workflow:</h3>
          <div style={styles.workflowSteps}>
            <div style={styles.workflowStep}>
              <span style={styles.stepNumber}>1</span>
              <div style={styles.stepContent}>
                <strong>Schema Discovery</strong>
                <p>Analyze Airtable structure and create PostgreSQL tables with snake_case naming</p>
              </div>
            </div>
            <div style={styles.workflowStep}>
              <span style={styles.stepNumber}>2</span>
              <div style={styles.stepContent}>
                <strong>Full Data Import</strong>
                <p>Import ALL records from all tables (not just samples). Auto-create ENUMs for select fields with ≤20 options.</p>
              </div>
            </div>
            <div style={styles.workflowStep}>
              <span style={styles.stepNumber}>3</span>
              <div style={styles.stepContent}>
                <strong>Relationship Analysis</strong>
                <p>Analyze imported data in PostgreSQL to detect foreign key relationships with confidence scoring</p>
              </div>
            </div>
            <div style={styles.workflowStep}>
              <span style={styles.stepNumber}>4</span>
              <div style={styles.stepContent}>
                <strong>Schema Enhancement</strong>
                <p>Create foreign key constraints and junction tables based on detected relationships</p>
              </div>
            </div>
          </div>

          <div style={styles.importWarning}>
            <h4>⚠️ Important Notes:</h4>
            <ul>
              <li>This will import ALL data from your Airtable base (not just samples)</li>
              <li>The process may take several minutes for large datasets</li>
              <li>Database tables will be created and populated before relationship analysis</li>
              <li>You can still review and modify relationship suggestions in the next steps</li>
            </ul>
          </div>

          <div style={styles.confirmationActions}>
            <button
              onClick={() => {
                setImportConfirmed(true);
                setCurrentStep(1);
                // Start the full import workflow
                startFullImportWorkflow();
              }}
              style={styles.primaryButton}
              disabled={loading}
            >
              🚀 Start Full Import Process
            </button>
            <button
              onClick={onCancel}
              style={styles.secondaryButton}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  /**
   * Step 1: Analysis step with TQDM-style progress.
   */
  const renderAnalysisStep = () => {
    return (
      <div style={styles.stepContainer}>
        <div style={styles.stepHeader}>
          <h2>Data Pattern Analysis - Step 1 of 3</h2>
          <p>Analyzing your Airtable data to intelligently detect relationships using statistical analysis.</p>
        </div>

        {!loading && dataPatterns.length === 0 && (
          <div style={styles.analysisIntro}>
            <h3>What This Analysis Does:</h3>
            <ul style={styles.featureList}>
              <li>✅ Analyzes actual data patterns instead of just schema metadata</li>
              <li>✅ Calculates confidence levels for relationship suggestions</li>
              <li>✅ Auto-suggests relationships with ≥70% confidence</li>
              <li>✅ Always asks for user confirmation before applying changes</li>
              <li>✅ Keeps foreign keys on the "many" side of relationships</li>
              <li>✅ Provides detailed reasoning for each suggestion</li>
            </ul>
            
            <div style={styles.tablesSummary}>
              <h4>Tables to Analyze:</h4>
              <div style={styles.tablesGrid}>
                {tables.map((table, index) => (
                  <div key={index} style={styles.tableCard}>
                    <strong>{table.name}</strong>
                    <span>{table.records?.length || 0} records</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={startFullImportWorkflow}
              style={styles.primaryButton}
            >
              Start Data Analysis
            </button>
          </div>
        )}

        {(loading || analysisLogs.length > 0) && (
          <div style={styles.progressContainer}>
            <h3>Hybrid Relationship Analysis</h3>
            <div style={styles.progressBar}>
              <div 
                style={{
                  ...styles.progressFill,
                  width: `${analysisProgress}%`
                }}
              />
            </div>
            <div style={styles.progressText}>
              {analysisProgress}% Complete
            </div>
            
            {/* Console-like logging output */}
            <div style={styles.consoleContainer}>
              <div style={styles.consoleHeader}>Analysis Console</div>
              <div style={styles.consoleLogs}>
                {analysisLogs.map((log, index) => (
                  <div key={index} style={styles.consoleLogLine}>
                    {log}
                  </div>
                ))}
                {loading && (
                  <div style={styles.consoleLogLine}>
                    <span style={styles.cursor}>▋</span>
                  </div>
                )}
              </div>
            </div>
            
            {analysisComplete && (
              <div style={styles.analysisCompleteMessage}>
                ✅ Analysis complete! Proceeding to configuration...
              </div>
            )}
          </div>
        )}

        {error && (
          <div style={styles.errorContainer}>
            <h3>Analysis Error</h3>
            <p>{error}</p>
            <button
              onClick={() => {
                setError(null);
                startFullImportWorkflow();
              }}
              style={styles.primaryButton}
            >
              Retry Analysis
            </button>
          </div>
        )}
      </div>
    );
  };

  // Main render function
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>Enhanced Relationship Wizard</h1>
        <p>Intelligent data-driven relationship detection with user confirmation</p>
        <div style={styles.stepIndicator}>
          <div style={{
            ...styles.stepDot,
            backgroundColor: currentStep >= 0 ? '#3b82f6' : '#e5e7eb'
          }}>0</div>
          <div style={styles.stepLine} />
          <div style={{
            ...styles.stepDot,
            backgroundColor: currentStep >= 1 ? '#3b82f6' : '#e5e7eb'
          }}>1</div>
          <div style={styles.stepLine} />
          <div style={{
            ...styles.stepDot,
            backgroundColor: currentStep >= 2 ? '#3b82f6' : '#e5e7eb'
          }}>2</div>
          <div style={styles.stepLine} />
          <div style={{
            ...styles.stepDot,
            backgroundColor: currentStep >= 3 ? '#3b82f6' : '#e5e7eb'
          }}>3</div>
        </div>
      </div>

      {currentStep === 0 && renderImportConfirmationStep()}
      {currentStep === 1 && renderAnalysisStep()}
      {currentStep === 2 && renderConfirmationStep()}
      {currentStep === 3 && renderConfigurationPreview()}

      <div style={styles.footer}>
        <button
          onClick={onCancel}
          style={styles.cancelButton}
        >
          Cancel Wizard
        </button>
      </div>
    </div>
  );
};

// Comprehensive styles for the enhanced wizard
const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '40px',
    borderBottom: '2px solid #e5e7eb',
    paddingBottom: '20px'
  },
  stepIndicator: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '20px'
  },
  stepDot: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: 'bold',
    fontSize: '16px'
  },
  stepLine: {
    width: '60px',
    height: '2px',
    backgroundColor: '#e5e7eb',
    margin: '0 10px'
  },
  stepContainer: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '30px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    marginBottom: '20px'
  },
  stepHeader: {
    marginBottom: '30px'
  },
  sectionContainer: {
    marginBottom: '30px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '20px'
  },
  sectionTitle: {
    color: '#1f2937',
    marginBottom: '10px',
    fontSize: '18px'
  },
  sectionDescription: {
    color: '#6b7280',
    marginBottom: '20px',
    fontSize: '14px'
  },
  relationshipCard: {
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '15px',
    backgroundColor: '#f9fafb'
  },
  relationshipHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px'
  },
  relationshipTitle: {
    fontSize: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  arrow: {
    color: '#6b7280',
    fontSize: '18px'
  },
  confidenceBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px'
  },
  confidenceLabel: {
    fontSize: '12px',
    color: '#6b7280'
  },
  confidenceValue: {
    fontSize: '14px',
    fontWeight: 'bold'
  },
  reasoningText: {
    fontSize: '14px',
    color: '#4b5563',
    marginBottom: '15px',
    padding: '10px',
    backgroundColor: '#f3f4f6',
    borderRadius: '4px'
  },
  configurationRow: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '10px',
    gap: '10px'
  },
  configurationLabel: {
    minWidth: '120px',
    fontSize: '14px',
    fontWeight: '500'
  },
  select: {
    padding: '8px 12px',
    borderRadius: '4px',
    border: '1px solid #d1d5db',
    fontSize: '14px',
    minWidth: '150px'
  },
  foreignKeyInfo: {
    fontSize: '12px',
    color: '#6b7280',
    marginBottom: '10px',
    fontStyle: 'italic'
  },
  confirmationRow: {
    marginTop: '15px'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    cursor: 'pointer'
  },
  checkbox: {
    width: '16px',
    height: '16px'
  },
  autoSuggestedBadge: {
    marginTop: '10px',
    padding: '4px 8px',
    backgroundColor: '#dbeafe',
    color: '#1e40af',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500'
  },
  summaryContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '15px',
    padding: '20px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    marginBottom: '20px'
  },
  summaryItem: {
    fontSize: '14px'
  },
  stepNavigation: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '30px'
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  secondaryButton: {
    backgroundColor: '#f3f4f6',
    color: '#374151',
    border: '1px solid #d1d5db',
    padding: '12px 24px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  cancelButton: {
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer'
  },
  analysisIntro: {
    textAlign: 'center' as const
  },
  featureList: {
    textAlign: 'left' as const,
    maxWidth: '600px',
    margin: '0 auto 30px auto',
    lineHeight: '1.6'
  },
  tablesSummary: {
    marginBottom: '30px'
  },
  tablesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '10px',
    marginTop: '15px'
  },
  tableCard: {
    padding: '10px',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '14px'
  },
  progressContainer: {
    textAlign: 'center' as const
  },
  progressBar: {
    width: '100%',
    height: '20px',
    backgroundColor: '#e5e7eb',
    borderRadius: '10px',
    overflow: 'hidden',
    margin: '20px 0'
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    transition: 'width 0.3s ease'
  },
  progressText: {
    fontSize: '18px',
    fontWeight: 'bold',
    marginBottom: '10px'
  },
  progressDetails: {
    fontSize: '14px',
    color: '#6b7280'
  },
  errorContainer: {
    textAlign: 'center' as const,
    color: '#ef4444'
  },
  configurationSummary: {
    marginBottom: '30px'
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '15px',
    marginTop: '20px'
  },
  summaryCard: {
    textAlign: 'center' as const,
    padding: '20px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    border: '1px solid #e5e7eb'
  },
  summaryNumber: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#3b82f6',
    marginBottom: '5px'
  },
  summaryLabel: {
    fontSize: '12px',
    color: '#6b7280'
  },
  relationshipDetails: {
    marginBottom: '30px'
  },
  relationshipDetailCard: {
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    padding: '15px',
    marginBottom: '10px'
  },
  relationshipDetailHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '5px'
  },
  relationshipType: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500'
  },
  relationshipDetailInfo: {
    fontSize: '12px',
    color: '#6b7280'
  },
  finalActions: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '30px'
  },
  footer: {
    textAlign: 'center' as const,
    marginTop: '20px'
  },
  // Console-like logging styles
  consoleContainer: {
    marginTop: '20px',
    border: '1px solid #374151',
    borderRadius: '8px',
    backgroundColor: '#1f2937',
    overflow: 'hidden'
  },
  consoleHeader: {
    backgroundColor: '#374151',
    color: '#f9fafb',
    padding: '8px 16px',
    fontSize: '12px',
    fontWeight: '500',
    borderBottom: '1px solid #4b5563'
  },
  consoleLogs: {
    padding: '12px 16px',
    maxHeight: '300px',
    overflowY: 'auto' as const,
    fontFamily: 'Monaco, Consolas, "Courier New", monospace',
    fontSize: '12px',
    lineHeight: '1.5'
  },
  consoleLogLine: {
    color: '#e5e7eb',
    marginBottom: '4px',
    whiteSpace: 'pre-wrap' as const
  },
  cursor: {
    color: '#10b981',
    animation: 'blink 1s infinite'
  },
  analysisCompleteMessage: {
    marginTop: '15px',
    padding: '12px',
    backgroundColor: '#dcfce7',
    color: '#166534',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    textAlign: 'center' as const
  },
  // New styles for confirmation step
  workflowExplanation: {
    marginTop: '20px'
  },
  workflowSteps: {
    marginBottom: '30px'
  },
  workflowStep: {
    display: 'flex',
    alignItems: 'flex-start',
    marginBottom: '20px',
    padding: '15px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    border: '1px solid #e5e7eb'
  },
  stepNumber: {
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    backgroundColor: '#3b82f6',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    fontSize: '14px',
    marginRight: '15px',
    flexShrink: 0
  },
  stepContent: {
    flex: 1
  },
  importWarning: {
    marginBottom: '30px',
    padding: '20px',
    backgroundColor: '#fef3c7',
    border: '1px solid #f59e0b',
    borderRadius: '8px'
  },
  confirmationActions: {
    display: 'flex',
    justifyContent: 'center',
    gap: '15px'
  }
};

export default EnhancedRelationshipWizard;