/**
 * Enhanced Relationship Wizard Component
 * 
 * This enhanced version integrates data-driven relationship detection with user confirmation.
 * Features 70%+ confidence auto-suggestions, manual overrides, and comprehensive FK management.
 * Always asks user for confirmation but provides intelligent autofill suggestions.
 */

import React, { useState, useEffect } from 'react';
import { importAPI } from '../services/api';

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
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [dataPatterns, setDataPatterns] = useState<DataPattern[]>([]);
  const [userConfirmations, setUserConfirmations] = useState<Record<string, any>>({});
  const [finalConfiguration, setFinalConfiguration] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Analysis and configuration states
  const [highConfidencePatterns, setHighConfidencePatterns] = useState<DataPattern[]>([]);
  const [lowConfidencePatterns, setLowConfidencePatterns] = useState<DataPattern[]>([]);
  const [autoSuggestions, setAutoSuggestions] = useState<DataPattern[]>([]);

  /**
   * Step 1: Analyze data patterns using statistical analysis.
   * Performs intelligent relationship detection with confidence scoring.
   */
  const analyzeDataPatterns = async () => {
    setLoading(true);
    setAnalysisProgress(0);
    setError(null);

    try {
      console.log('Starting data-driven relationship analysis...');
      
      // Simulate progress updates during analysis
      const progressInterval = setInterval(() => {
        setAnalysisProgress(prev => Math.min(prev + 5, 90));
      }, 200);

      // Call the data pattern analyzer
      const response = await importAPI.analyzeDataPatterns(tables);
      
      clearInterval(progressInterval);
      setAnalysisProgress(100);

      if (response.success) {
        const patterns = response.data.relationships || [];
        const recommendations = response.data.recommendations || {};

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
        setCurrentStep(2);
        console.log(`Analysis complete: ${patterns.length} relationships detected`);
      } else {
        throw new Error(response.error || 'Analysis failed');
      }
    } catch (error) {
      console.error('Data pattern analysis failed:', error);
      setError(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
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
              {pattern.suggestedForeignKey.junctionTable ? (
                <span> Junction table: {pattern.suggestedForeignKey.junctionTable.name}</span>
              ) : (
                <span> {pattern.suggestedForeignKey.foreignKeyTable}.{pattern.suggestedForeignKey.foreignKeyColumn} → {pattern.suggestedForeignKey.referencesTable}</span>
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
              onClick={analyzeDataPatterns}
              style={styles.primaryButton}
            >
              Start Data Analysis
            </button>
          </div>
        )}

        {loading && (
          <div style={styles.progressContainer}>
            <h3>Analyzing Data Patterns...</h3>
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
            <div style={styles.progressDetails}>
              Performing statistical analysis of linked record fields, calculating confidence scores, and generating relationship recommendations...
            </div>
          </div>
        )}

        {error && (
          <div style={styles.errorContainer}>
            <h3>Analysis Error</h3>
            <p>{error}</p>
            <button
              onClick={() => {
                setError(null);
                analyzeDataPatterns();
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
  }
};

export default EnhancedRelationshipWizard;