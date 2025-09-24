/**
 * Relationship Wizard Component
 * 
 * Interactive wizard for manually reviewing and adjusting detected database relationships.
 * Allows users to override AI-detected relationship types and configure special field handling.
 * 
 * @author GitHub Copilot
 * @version 1.0.0
 */

import React, { useState, useEffect } from 'react';
import { importAPI } from '../services/api';

/**
 * Interface for relationship configuration in the wizard
 */
interface RelationshipWizardItem {
  id: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  detectedType: string;
  configuredType: string;
  confidence: 'high' | 'medium' | 'low';
  hasInverse: boolean;
  inverseRelationship?: {
    sourceTable: string;
    sourceColumn: string;
    targetTable: string;
    targetColumn: string;
  };
  specialField?: {
    type: string;
    options: any;
    recommendedHandling: string;
  };
  sqlPreview: string;
}

/**
 * Interface for field type analysis results
 */
interface FieldTypeAnalysis {
  singleSelects: Array<{
    tableName: string;
    fieldName: string;
    choices: Array<{ id: string; name: string; color: string }>;
    recommendedHandling: 'enum' | 'reference_table';
  }>;
  multipleSelects: Array<{
    tableName: string;
    fieldName: string;
    choices: Array<{ id: string; name: string; color: string }>;
    requiresJunctionTable: boolean;
  }>;
  lookupValues: Array<{
    tableName: string;
    fieldName: string;
    sourceField: string;
    targetField: string;
    recommendedHandling: 'view' | 'computed_column';
  }>;
  collaborators: Array<{
    tableName: string;
    fieldName: string;
    isMultiple: boolean;
    recommendedHandling: 'user_reference' | 'junction_table';
  }>;
}

/**
 * Props interface for the RelationshipWizard component
 */
interface RelationshipWizardProps {
  /** Callback when wizard is completed */
  onComplete: (relationships: RelationshipWizardItem[], fieldConfig: FieldTypeAnalysis) => void;
  /** Callback when wizard is cancelled */
  onCancel: () => void;
  /** Whether to show advanced options */
  showAdvanced?: boolean;
}

/**
 * RelationshipWizard component provides manual review and configuration of database relationships
 */
const RelationshipWizard: React.FC<RelationshipWizardProps> = ({ 
  onComplete, 
  onCancel, 
  showAdvanced = false 
}) => {
  // State management for wizard data
  const [relationships, setRelationships] = useState<RelationshipWizardItem[]>([]);
  const [fieldAnalysis, setFieldAnalysis] = useState<FieldTypeAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<'loading' | 'relationships' | 'fields' | 'review'>('loading');
  const [selectedRelationship, setSelectedRelationship] = useState<string | null>(null);

  // Relationship type options for the dropdown
  const relationshipTypes = [
    { value: 'one-to-one', label: 'One-to-One (1:1)', description: 'Each record relates to exactly one other record' },
    { value: 'one-to-many', label: 'One-to-Many (1:M)', description: 'One record can relate to many others' },
    { value: 'many-to-one', label: 'Many-to-One (M:1)', description: 'Many records relate to one record' },
    { value: 'many-to-many', label: 'Many-to-Many (M:M)', description: 'Many records can relate to many others' },
    { value: 'remove', label: 'Remove Relationship', description: 'Do not create this relationship in PostgreSQL' }
  ];

  /**
   * Loads relationship analysis and field type analysis from the backend
   */
  const loadWizardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🧙‍♂️ Loading relationship wizard data...');
      
      // Get comprehensive relationship analysis
      const relationshipResponse = await importAPI.analyzeRelationships();
      
      // Get field type analysis (we'll need to create this endpoint)
      const fieldResponse = await importAPI.analyzeFieldTypes();
      
      // Transform relationship data for wizard
      const wizardRelationships: RelationshipWizardItem[] = relationshipResponse.data.relationships.map((rel: any, index: number) => ({
        id: `rel_${index}`,
        sourceTable: rel.sourceTable,
        sourceColumn: rel.sourceColumn,
        targetTable: rel.targetTable,
        targetColumn: rel.targetColumn,
        detectedType: rel.relationshipType,
        configuredType: rel.relationshipType, // Start with detected type
        confidence: determineConfidence(rel),
        hasInverse: !!rel.inverseRelationship,
        inverseRelationship: rel.inverseRelationship,
        specialField: rel.specialField,
        sqlPreview: rel.sql
      }));
      
      setRelationships(wizardRelationships);
      setFieldAnalysis(fieldResponse.data);
      setCurrentStep('relationships');
      
      console.log(`🧙‍♂️ Loaded ${wizardRelationships.length} relationships for review`);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('❌ Failed to load wizard data:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Determines confidence level based on relationship characteristics
   */
  const determineConfidence = (relationship: any): 'high' | 'medium' | 'low' => {
    if (relationship.hasPrefersSingleSetting && relationship.hasInverseField) {
      return 'high';
    } else if (relationship.hasInverseField) {
      return 'medium';
    } else {
      return 'low';
    }
  };

  /**
   * Updates a relationship configuration
   */
  const updateRelationship = (relationshipId: string, updates: Partial<RelationshipWizardItem>) => {
    setRelationships(prev => prev.map(rel => 
      rel.id === relationshipId ? { ...rel, ...updates } : rel
    ));
  };

  /**
   * Generates SQL preview for a relationship configuration
   */
  const generateSQLPreview = (relationship: RelationshipWizardItem): string => {
    switch (relationship.configuredType) {
      case 'one-to-one':
      case 'many-to-one':
        return `ALTER TABLE "${relationship.sourceTable}" 
ADD CONSTRAINT "fk_${relationship.sourceTable}_${relationship.sourceColumn}_${relationship.targetTable}" 
FOREIGN KEY ("${relationship.sourceColumn}") 
REFERENCES "${relationship.targetTable}"("${relationship.targetColumn}");`;
      
      case 'one-to-many':
        return `ALTER TABLE "${relationship.targetTable}" 
ADD CONSTRAINT "fk_${relationship.targetTable}_${relationship.sourceColumn}_${relationship.sourceTable}" 
FOREIGN KEY ("${relationship.sourceColumn}_id") 
REFERENCES "${relationship.sourceTable}"("id");`;
      
      case 'many-to-many':
        const junctionTable = `${relationship.sourceTable}_${relationship.targetTable}`;
        return `CREATE TABLE "${junctionTable}" (
  "${relationship.sourceTable}_id" INTEGER REFERENCES "${relationship.sourceTable}"("id"),
  "${relationship.targetTable}_id" INTEGER REFERENCES "${relationship.targetTable}"("id"),
  PRIMARY KEY ("${relationship.sourceTable}_id", "${relationship.targetTable}_id")
);`;
      
      case 'remove':
        return '-- Relationship will not be created in PostgreSQL';
      
      default:
        return '-- Unknown relationship type';
    }
  };

  /**
   * Renders the relationship configuration step
   */
  const renderRelationshipStep = () => {
    const groupedRelationships = relationships.reduce((acc, rel) => {
      const key = `${rel.sourceTable} ↔ ${rel.targetTable}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(rel);
      return acc;
    }, {} as Record<string, RelationshipWizardItem[]>);

    return (
      <div style={styles.step}>
        <div style={styles.stepHeader}>
          <h3 style={styles.stepTitle}>📊 Review Detected Relationships</h3>
          <p style={styles.stepDescription}>
            Review and adjust the automatically detected relationships. 
            Red badges indicate low confidence detections that need manual review.
          </p>
        </div>

        <div style={styles.relationshipGroups}>
          {Object.entries(groupedRelationships).map(([groupName, groupRels]) => (
            <div key={groupName} style={styles.relationshipGroup}>
              <h4 style={styles.groupTitle}>{groupName}</h4>
              
              {groupRels.map(relationship => (
                <div 
                  key={relationship.id} 
                  style={{
                    ...styles.relationshipItem,
                    ...(selectedRelationship === relationship.id ? styles.relationshipItemSelected : {})
                  }}
                  onClick={() => setSelectedRelationship(relationship.id)}
                >
                  <div style={styles.relationshipHeader}>
                    <div style={styles.relationshipPath}>
                      <span style={styles.tableName}>{relationship.sourceTable}</span>
                      <span style={styles.fieldName}>.{relationship.sourceColumn}</span>
                      <span style={styles.arrow}>→</span>
                      <span style={styles.tableName}>{relationship.targetTable}</span>
                      <span style={styles.fieldName}>.{relationship.targetColumn}</span>
                    </div>
                    
                    <div style={styles.relationshipBadges}>
                      <span style={{
                        ...styles.confidenceBadge,
                        ...(relationship.confidence === 'high' ? styles.confidenceHigh : 
                           relationship.confidence === 'medium' ? styles.confidenceMedium : 
                           styles.confidenceLow)
                      }}>
                        {relationship.confidence} confidence
                      </span>
                      
                      {relationship.hasInverse && (
                        <span style={styles.inverseBadge}>bidirectional</span>
                      )}
                    </div>
                  </div>

                  <div style={styles.relationshipConfig}>
                    <div style={styles.configRow}>
                      <label style={styles.configLabel}>Relationship Type:</label>
                      <select
                        value={relationship.configuredType}
                        onChange={(e) => {
                          const newType = e.target.value;
                          const sqlPreview = generateSQLPreview({ ...relationship, configuredType: newType });
                          updateRelationship(relationship.id, { 
                            configuredType: newType,
                            sqlPreview 
                          });
                        }}
                        style={styles.relationshipSelect}
                      >
                        {relationshipTypes.map(type => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={styles.configRow}>
                      <label style={styles.configLabel}>Detected as:</label>
                      <span style={styles.detectedType}>{relationship.detectedType}</span>
                    </div>

                    {relationship.hasInverse && (
                      <div style={styles.configRow}>
                        <label style={styles.configLabel}>
                          <input
                            type="checkbox"
                            checked={relationship.configuredType !== 'remove'}
                            onChange={(e) => {
                              if (!e.target.checked) {
                                updateRelationship(relationship.id, { configuredType: 'remove' });
                              }
                            }}
                            style={styles.checkbox}
                          />
                          Keep inverse relationship
                        </label>
                      </div>
                    )}
                  </div>

                  {selectedRelationship === relationship.id && (
                    <div style={styles.sqlPreview}>
                      <h5 style={styles.sqlTitle}>SQL Preview:</h5>
                      <pre style={styles.sqlCode}>{relationship.sqlPreview}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div style={styles.stepActions}>
          <button onClick={() => setCurrentStep('fields')} style={styles.nextButton}>
            Next: Review Field Types →
          </button>
        </div>
      </div>
    );
  };

  /**
   * Renders the field type configuration step
   */
  const renderFieldStep = () => {
    if (!fieldAnalysis) return null;

    return (
      <div style={styles.step}>
        <div style={styles.stepHeader}>
          <h3 style={styles.stepTitle}>🔧 Configure Special Field Types</h3>
          <p style={styles.stepDescription}>
            Configure how special Airtable field types should be handled in PostgreSQL.
          </p>
        </div>

        {/* Single Select Fields */}
        {fieldAnalysis.singleSelects.length > 0 && (
          <div style={styles.fieldSection}>
            <h4 style={styles.sectionTitle}>Single Select Fields</h4>
            {fieldAnalysis.singleSelects.map((field, index) => (
              <div key={index} style={styles.fieldItem}>
                <div style={styles.fieldHeader}>
                  <span style={styles.fieldPath}>{field.tableName}.{field.fieldName}</span>
                  <span style={styles.choiceCount}>{field.choices.length} choices</span>
                </div>
                
                <div style={styles.fieldConfig}>
                  <label style={styles.configLabel}>PostgreSQL Handling:</label>
                  <select style={styles.fieldSelect} defaultValue={field.recommendedHandling}>
                    <option value="enum">PostgreSQL ENUM (recommended for &lt;20 choices)</option>
                    <option value="reference_table">Reference Table (flexible, allows additions)</option>
                  </select>
                </div>

                <div style={styles.choicesList}>
                  <strong>Choices:</strong>
                  {field.choices.slice(0, 5).map(choice => (
                    <span key={choice.id} style={styles.choiceTag}>{choice.name}</span>
                  ))}
                  {field.choices.length > 5 && (
                    <span style={styles.moreChoices}>+{field.choices.length - 5} more</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Multiple Select Fields */}
        {fieldAnalysis.multipleSelects.length > 0 && (
          <div style={styles.fieldSection}>
            <h4 style={styles.sectionTitle}>Multiple Select Fields</h4>
            {fieldAnalysis.multipleSelects.map((field, index) => (
              <div key={index} style={styles.fieldItem}>
                <div style={styles.fieldHeader}>
                  <span style={styles.fieldPath}>{field.tableName}.{field.fieldName}</span>
                  <span style={styles.junctionBadge}>Requires Junction Table</span>
                </div>
                
                <div style={styles.sqlPreview}>
                  <pre style={styles.sqlCode}>
{`-- Junction table for ${field.tableName}.${field.fieldName}
CREATE TABLE "${field.tableName}_${field.fieldName}_options" (
  ${field.tableName}_id INTEGER REFERENCES "${field.tableName}"(id),
  option_value VARCHAR(255),
  PRIMARY KEY (${field.tableName}_id, option_value)
);`}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Lookup Values */}
        {fieldAnalysis.lookupValues.length > 0 && (
          <div style={styles.fieldSection}>
            <h4 style={styles.sectionTitle}>Lookup Value Fields</h4>
            <p style={styles.sectionNote}>
              Lookup fields will be created as PostgreSQL views since they're computed values.
            </p>
            {fieldAnalysis.lookupValues.map((field, index) => (
              <div key={index} style={styles.fieldItem}>
                <div style={styles.fieldHeader}>
                  <span style={styles.fieldPath}>{field.tableName}.{field.fieldName}</span>
                  <span style={styles.viewBadge}>Will create VIEW</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={styles.stepActions}>
          <button onClick={() => setCurrentStep('relationships')} style={styles.backButton}>
            ← Back: Relationships
          </button>
          <button onClick={() => setCurrentStep('review')} style={styles.nextButton}>
            Next: Review & Complete →
          </button>
        </div>
      </div>
    );
  };

  /**
   * Renders the final review step
   */
  const renderReviewStep = () => {
    const activeRelationships = relationships.filter(rel => rel.configuredType !== 'remove');
    const removedRelationships = relationships.filter(rel => rel.configuredType === 'remove');

    return (
      <div style={styles.step}>
        <div style={styles.stepHeader}>
          <h3 style={styles.stepTitle}>📋 Review Configuration</h3>
          <p style={styles.stepDescription}>
            Review your final relationship configuration before applying to your database schema.
          </p>
        </div>

        <div style={styles.reviewSummary}>
          <div style={styles.summaryCard}>
            <h4>Relationships to Create</h4>
            <div style={styles.summaryStats}>
              <div style={styles.stat}>
                <span style={styles.statNumber}>{activeRelationships.length}</span>
                <span style={styles.statLabel}>Total Relationships</span>
              </div>
              <div style={styles.stat}>
                <span style={styles.statNumber}>
                  {activeRelationships.filter(r => r.configuredType === 'many-to-many').length}
                </span>
                <span style={styles.statLabel}>Junction Tables</span>
              </div>
              <div style={styles.stat}>
                <span style={styles.statNumber}>{removedRelationships.length}</span>
                <span style={styles.statLabel}>Relationships Removed</span>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.stepActions}>
          <button onClick={() => setCurrentStep('fields')} style={styles.backButton}>
            ← Back: Field Types
          </button>
          <button 
            onClick={() => onComplete(relationships, fieldAnalysis!)} 
            style={styles.completeButton}
          >
            ✅ Complete Configuration
          </button>
        </div>
      </div>
    );
  };

  // Load data on component mount
  useEffect(() => {
    loadWizardData();
  }, []);

  // Render loading state
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>
          <div style={styles.spinner}></div>
          <h3>Loading Relationship Analysis...</h3>
          <p>Analyzing your Airtable schema and detecting relationships...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>
          <h3>❌ Failed to Load Wizard</h3>
          <p>{error}</p>
          <button onClick={loadWizardData} style={styles.retryButton}>
            🔄 Retry
          </button>
          <button onClick={onCancel} style={styles.cancelButton}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>🧙‍♂️ Database Relationship Wizard</h2>
        <div style={styles.progressBar}>
          <div style={styles.progressStep} data-active={currentStep === 'relationships'}>
            1. Relationships
          </div>
          <div style={styles.progressStep} data-active={currentStep === 'fields'}>
            2. Field Types
          </div>
          <div style={styles.progressStep} data-active={currentStep === 'review'}>
            3. Review
          </div>
        </div>
      </div>

      {currentStep === 'relationships' && renderRelationshipStep()}
      {currentStep === 'fields' && renderFieldStep()}
      {currentStep === 'review' && renderReviewStep()}
    </div>
  );
};

// Comprehensive styling for the wizard component
const styles = {
  // Main container with full viewport styling
  container: {
    minHeight: '100vh',
    backgroundColor: '#f8fafc',
    padding: '20px'
  } as React.CSSProperties,

  // Wizard header with title and progress
  header: {
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '12px',
    marginBottom: '24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  } as React.CSSProperties,

  // Main wizard title
  title: {
    margin: '0 0 20px 0',
    fontSize: '28px',
    fontWeight: 700,
    color: '#1f2937'
  } as React.CSSProperties,

  // Progress bar container
  progressBar: {
    display: 'flex',
    gap: '12px'
  } as React.CSSProperties,

  // Individual progress steps
  progressStep: {
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 500,
    backgroundColor: '#e5e7eb',
    color: '#6b7280'
  } as React.CSSProperties,

  // Step container
  step: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  } as React.CSSProperties,

  // Step header with title and description
  stepHeader: {
    marginBottom: '32px'
  } as React.CSSProperties,

  // Step title
  stepTitle: {
    margin: '0 0 8px 0',
    fontSize: '24px',
    fontWeight: 600,
    color: '#1f2937'
  } as React.CSSProperties,

  // Step description
  stepDescription: {
    margin: 0,
    fontSize: '16px',
    color: '#6b7280',
    lineHeight: 1.6
  } as React.CSSProperties,

  // Loading state styling
  loading: {
    textAlign: 'center' as const,
    padding: '60px 20px',
    backgroundColor: 'white',
    borderRadius: '12px'
  } as React.CSSProperties,

  // Loading spinner
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e5e7eb',
    borderTop: '4px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 20px'
  } as React.CSSProperties,

  // Error state styling
  error: {
    textAlign: 'center' as const,
    padding: '60px 20px',
    backgroundColor: 'white',
    borderRadius: '12px'
  } as React.CSSProperties,

  // Relationship groups container
  relationshipGroups: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px'
  } as React.CSSProperties,

  // Individual relationship group
  relationshipGroup: {
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    overflow: 'hidden'
  } as React.CSSProperties,

  // Group title
  groupTitle: {
    margin: 0,
    padding: '16px 20px',
    backgroundColor: '#f8fafc',
    fontSize: '18px',
    fontWeight: 600,
    color: '#1f2937',
    borderBottom: '1px solid #e5e7eb'
  } as React.CSSProperties,

  // Individual relationship item
  relationshipItem: {
    padding: '20px',
    borderBottom: '1px solid #e5e7eb',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  } as React.CSSProperties,

  // Selected relationship item
  relationshipItemSelected: {
    backgroundColor: '#f0f9ff',
    borderColor: '#3b82f6'
  } as React.CSSProperties,

  // Relationship header with path and badges
  relationshipHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  } as React.CSSProperties,

  // Relationship path display
  relationshipPath: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '16px',
    fontWeight: 500
  } as React.CSSProperties,

  // Table name styling
  tableName: {
    color: '#1f2937',
    fontWeight: 600
  } as React.CSSProperties,

  // Field name styling
  fieldName: {
    color: '#6b7280'
  } as React.CSSProperties,

  // Arrow between relationships
  arrow: {
    color: '#3b82f6',
    fontWeight: 700
  } as React.CSSProperties,

  // Relationship badges container
  relationshipBadges: {
    display: 'flex',
    gap: '8px'
  } as React.CSSProperties,

  // Base badge styling
  confidenceBadge: {
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 500
  } as React.CSSProperties,

  // High confidence badge
  confidenceHigh: {
    backgroundColor: '#dcfce7',
    color: '#166534'
  } as React.CSSProperties,

  // Medium confidence badge
  confidenceMedium: {
    backgroundColor: '#fef3c7',
    color: '#92400e'
  } as React.CSSProperties,

  // Low confidence badge
  confidenceLow: {
    backgroundColor: '#fecaca',
    color: '#dc2626'
  } as React.CSSProperties,

  // Inverse relationship badge
  inverseBadge: {
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 500,
    backgroundColor: '#e0e7ff',
    color: '#3730a3'
  } as React.CSSProperties,

  // Relationship configuration section
  relationshipConfig: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px'
  } as React.CSSProperties,

  // Configuration row
  configRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  } as React.CSSProperties,

  // Configuration label
  configLabel: {
    minWidth: '140px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#374151'
  } as React.CSSProperties,

  // Relationship type select
  relationshipSelect: {
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    minWidth: '200px'
  } as React.CSSProperties,

  // Detected type display
  detectedType: {
    fontSize: '14px',
    color: '#6b7280',
    fontStyle: 'italic'
  } as React.CSSProperties,

  // Checkbox styling
  checkbox: {
    marginRight: '8px'
  } as React.CSSProperties,

  // SQL preview section
  sqlPreview: {
    marginTop: '16px',
    padding: '16px',
    backgroundColor: '#f8fafc',
    borderRadius: '6px',
    border: '1px solid #e5e7eb'
  } as React.CSSProperties,

  // SQL preview title
  sqlTitle: {
    margin: '0 0 8px 0',
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151'
  } as React.CSSProperties,

  // SQL code display
  sqlCode: {
    margin: 0,
    fontSize: '12px',
    fontFamily: 'Monaco, Consolas, monospace',
    color: '#1f2937',
    whiteSpace: 'pre-wrap' as const,
    lineHeight: 1.4
  } as React.CSSProperties,

  // Field section container
  fieldSection: {
    marginBottom: '32px'
  } as React.CSSProperties,

  // Section title
  sectionTitle: {
    margin: '0 0 16px 0',
    fontSize: '18px',
    fontWeight: 600,
    color: '#1f2937'
  } as React.CSSProperties,

  // Section note
  sectionNote: {
    margin: '0 0 16px 0',
    fontSize: '14px',
    color: '#6b7280',
    fontStyle: 'italic'
  } as React.CSSProperties,

  // Individual field item
  fieldItem: {
    padding: '16px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    marginBottom: '12px'
  } as React.CSSProperties,

  // Field header
  fieldHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  } as React.CSSProperties,

  // Field path display
  fieldPath: {
    fontSize: '16px',
    fontWeight: 500,
    color: '#1f2937'
  } as React.CSSProperties,

  // Choice count badge
  choiceCount: {
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 500,
    backgroundColor: '#e0e7ff',
    color: '#3730a3'
  } as React.CSSProperties,

  // Junction table badge
  junctionBadge: {
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 500,
    backgroundColor: '#fef3c7',
    color: '#92400e'
  } as React.CSSProperties,

  // View badge
  viewBadge: {
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 500,
    backgroundColor: '#dcfce7',
    color: '#166534'
  } as React.CSSProperties,

  // Field configuration
  fieldConfig: {
    marginBottom: '12px'
  } as React.CSSProperties,

  // Field select dropdown
  fieldSelect: {
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    minWidth: '300px'
  } as React.CSSProperties,

  // Choices list
  choicesList: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '8px',
    alignItems: 'center',
    fontSize: '14px',
    color: '#374151'
  } as React.CSSProperties,

  // Individual choice tag
  choiceTag: {
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    backgroundColor: '#f3f4f6',
    color: '#374151'
  } as React.CSSProperties,

  // More choices indicator
  moreChoices: {
    fontSize: '12px',
    color: '#6b7280',
    fontStyle: 'italic'
  } as React.CSSProperties,

  // Review summary section
  reviewSummary: {
    marginBottom: '32px'
  } as React.CSSProperties,

  // Summary card
  summaryCard: {
    padding: '24px',
    backgroundColor: '#f8fafc',
    border: '1px solid #e5e7eb',
    borderRadius: '8px'
  } as React.CSSProperties,

  // Summary statistics
  summaryStats: {
    display: 'flex',
    gap: '32px',
    marginTop: '16px'
  } as React.CSSProperties,

  // Individual stat
  stat: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center'
  } as React.CSSProperties,

  // Stat number
  statNumber: {
    fontSize: '32px',
    fontWeight: 700,
    color: '#1f2937'
  } as React.CSSProperties,

  // Stat label
  statLabel: {
    fontSize: '14px',
    color: '#6b7280'
  } as React.CSSProperties,

  // Step actions container
  stepActions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '32px',
    paddingTop: '24px',
    borderTop: '1px solid #e5e7eb'
  } as React.CSSProperties,

  // Back button
  backButton: {
    padding: '12px 24px',
    backgroundColor: '#f3f4f6',
    color: '#374151',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: 500,
    cursor: 'pointer'
  } as React.CSSProperties,

  // Next button
  nextButton: {
    padding: '12px 24px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: 500,
    cursor: 'pointer'
  } as React.CSSProperties,

  // Complete button
  completeButton: {
    padding: '12px 24px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: 500,
    cursor: 'pointer'
  } as React.CSSProperties,

  // Retry button
  retryButton: {
    padding: '12px 24px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: 500,
    cursor: 'pointer',
    marginRight: '12px'
  } as React.CSSProperties,

  // Cancel button
  cancelButton: {
    padding: '12px 24px',
    backgroundColor: '#f3f4f6',
    color: '#374151',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: 500,
    cursor: 'pointer'
  } as React.CSSProperties
};

export default RelationshipWizard;