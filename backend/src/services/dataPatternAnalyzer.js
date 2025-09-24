/**
 * Data Pattern Analyzer Service
 * 
 * This service analyzes actual imported data patterns to intelligently detect relationships
 * between tables. Unlike schema-based detection, this uses statistical analysis of data
 * to determine relationship cardinality and confidence levels.
 * 
 * Key Features:
 * - Analyzes array lengths in linked record fields to determine cardinality
 * - Validates ID uniqueness and cross-table references
 * - Calculates confidence levels for relationship recommendations
 * - Provides automatic relationship type suggestions with user confirmation
 * - Always keeps foreign keys on the "many" side of relationships
 */

class DataPatternAnalyzer {
  constructor(databaseService) {
    this.db = databaseService;
    // Confidence threshold for automatic suggestions (70% as specified)
    this.CONFIDENCE_THRESHOLD = 0.70;
    // Minimum sample size for statistical analysis
    this.MIN_SAMPLE_SIZE = 10;
  }

  /**
   * Analyzes imported data patterns to detect relationships between tables.
   * Uses statistical analysis of actual data rather than schema metadata.
   * 
   * @param {Array} tables - Array of imported table data with records
   * @returns {Promise<Object>} Analysis results with relationship recommendations
   */
  async analyzeDataPatterns(tables) {
    console.log('Starting data pattern analysis for relationship detection...');
    
    try {
      // Step 1: Analyze field patterns in each table
      const fieldPatterns = await this.analyzeFieldPatterns(tables);
      
      // Step 2: Detect potential relationships based on data patterns
      const relationships = await this.detectRelationshipsFromData(fieldPatterns, tables);
      
      // Step 3: Calculate confidence levels for each relationship
      const relationshipsWithConfidence = await this.calculateConfidenceLevels(relationships, tables);
      
      // Step 4: Generate user-friendly recommendations
      const recommendations = await this.generateRecommendations(relationshipsWithConfidence);
      
      console.log(`Data pattern analysis complete: ${relationships.length} relationships detected`);
      
      return {
        fieldPatterns,
        relationships: relationshipsWithConfidence,
        recommendations,
        summary: {
          totalTables: tables.length,
          totalRelationships: relationships.length,
          highConfidenceRelationships: relationshipsWithConfidence.filter(r => r.confidence >= this.CONFIDENCE_THRESHOLD).length,
          lowConfidenceRelationships: relationshipsWithConfidence.filter(r => r.confidence < this.CONFIDENCE_THRESHOLD).length
        }
      };
    } catch (error) {
      console.error('Data pattern analysis failed:', error.message);
      throw new Error(`Data pattern analysis error: ${error.message}`);
    }
  }

  /**
   * Analyzes field patterns within each table to identify linked record fields
   * and their data characteristics (array lengths, ID patterns, etc.).
   * 
   * @param {Array} tables - Array of table data
   * @returns {Promise<Object>} Field pattern analysis results
   */
  async analyzeFieldPatterns(tables) {
    const patterns = {};
    
    for (const table of tables) {
      console.log(`Analyzing field patterns for table: ${table.name}`);
      patterns[table.name] = {
        totalRecords: table.records.length,
        linkedFields: {},
        idField: null,
        fieldTypes: {}
      };
      
      // Find the ID field (usually named 'id' or 'record_id')
      const sampleRecord = table.records[0];
      if (sampleRecord) {
        // Identify ID field by checking for unique identifier patterns
        for (const [fieldName, value] of Object.entries(sampleRecord.fields)) {
          if (fieldName.toLowerCase().includes('id') && typeof value === 'string') {
            patterns[table.name].idField = fieldName;
            break;
          }
        }
      }
      
      // Analyze each field in the table
      for (const record of table.records) {
        for (const [fieldName, value] of Object.entries(record.fields)) {
          // Initialize field analysis if not exists
          if (!patterns[table.name].fieldTypes[fieldName]) {
            patterns[table.name].fieldTypes[fieldName] = {
              type: this.inferFieldType(value),
              isLinkedRecord: false,
              arrayLengths: [],
              nullCount: 0,
              totalCount: 0,
              uniqueValues: new Set(),
              referencedTables: new Set()
            };
          }
          
          const fieldPattern = patterns[table.name].fieldTypes[fieldName];
          fieldPattern.totalCount++;
          
          // Analyze linked record fields (arrays of IDs)
          if (Array.isArray(value)) {
            fieldPattern.isLinkedRecord = true;
            fieldPattern.arrayLengths.push(value.length);
            
            // Track referenced IDs to identify target tables
            value.forEach(id => {
              if (id && typeof id === 'string') {
                fieldPattern.uniqueValues.add(id);
                // Try to identify which table this ID belongs to
                const referencedTable = this.identifyReferencedTable(id, tables);
                if (referencedTable) {
                  fieldPattern.referencedTables.add(referencedTable);
                }
              }
            });
          } else if (value === null || value === undefined) {
            fieldPattern.nullCount++;
          } else {
            fieldPattern.uniqueValues.add(value);
          }
        }
      }
      
      // Calculate statistics for linked fields
      for (const [fieldName, pattern] of Object.entries(patterns[table.name].fieldTypes)) {
        if (pattern.isLinkedRecord && pattern.arrayLengths.length > 0) {
          patterns[table.name].linkedFields[fieldName] = {
            ...pattern,
            statistics: {
              avgArrayLength: pattern.arrayLengths.reduce((a, b) => a + b, 0) / pattern.arrayLengths.length,
              maxArrayLength: Math.max(...pattern.arrayLengths),
              minArrayLength: Math.min(...pattern.arrayLengths),
              emptyArrayCount: pattern.arrayLengths.filter(len => len === 0).length,
              singleValueCount: pattern.arrayLengths.filter(len => len === 1).length,
              multiValueCount: pattern.arrayLengths.filter(len => len > 1).length,
              nullPercentage: pattern.nullCount / pattern.totalCount
            }
          };
        }
      }
    }
    
    return patterns;
  }

  /**
   * Detects relationships between tables based on data patterns analysis.
   * Uses statistical analysis of array lengths and cross-table references.
   * 
   * @param {Object} fieldPatterns - Field pattern analysis results
   * @param {Array} tables - Original table data
   * @returns {Promise<Array>} Detected relationships
   */
  async detectRelationshipsFromData(fieldPatterns, tables) {
    const relationships = [];
    
    for (const [tableName, tablePattern] of Object.entries(fieldPatterns)) {
      for (const [fieldName, linkedField] of Object.entries(tablePattern.linkedFields)) {
        // Skip if not enough data for analysis
        if (linkedField.totalCount < this.MIN_SAMPLE_SIZE) {
          console.log(`Skipping ${tableName}.${fieldName}: insufficient data (${linkedField.totalCount} records)`);
          continue;
        }
        
        // Determine relationship type based on statistical analysis
        const relationshipType = this.determineRelationshipType(linkedField.statistics);
        
        // Find the target table(s) for this relationship
        for (const referencedTable of linkedField.referencedTables) {
          const relationship = {
            sourceTable: tableName,
            sourceField: fieldName,
            targetTable: referencedTable,
            type: relationshipType,
            statistics: linkedField.statistics,
            dataEvidence: {
              totalReferences: linkedField.uniqueValues.size,
              avgReferencesPerRecord: linkedField.statistics.avgArrayLength,
              maxReferencesPerRecord: linkedField.statistics.maxArrayLength,
              singleReferencePercentage: linkedField.statistics.singleValueCount / linkedField.totalCount,
              multipleReferencePercentage: linkedField.statistics.multiValueCount / linkedField.totalCount,
              emptyReferencePercentage: linkedField.statistics.emptyArrayCount / linkedField.totalCount
            }
          };
          
          relationships.push(relationship);
          console.log(`Detected ${relationshipType} relationship: ${tableName}.${fieldName} -> ${referencedTable}`);
        }
      }
    }
    
    return relationships;
  }

  /**
   * Determines relationship type based on statistical analysis of array lengths.
   * Uses data patterns to infer one-to-one, one-to-many, or many-to-many relationships.
   * 
   * @param {Object} statistics - Statistical data about the linked field
   * @returns {string} Relationship type (one-to-one, one-to-many, many-to-many)
   */
  determineRelationshipType(statistics) {
    const singleValuePercentage = statistics.singleValueCount / (statistics.singleValueCount + statistics.multiValueCount);
    const avgArrayLength = statistics.avgArrayLength;
    const maxArrayLength = statistics.maxArrayLength;
    
    // One-to-One: Most records have exactly one reference
    if (singleValuePercentage > 0.8 && maxArrayLength <= 2) {
      return 'one-to-one';
    }
    
    // One-to-Many: Mixed pattern with some single, some multiple references
    if (singleValuePercentage > 0.3 && avgArrayLength < 3) {
      return 'one-to-many';
    }
    
    // Many-to-Many: Predominantly multiple references per record
    return 'many-to-many';
  }

  /**
   * Calculates confidence levels for detected relationships based on data quality
   * and statistical significance of the patterns.
   * 
   * @param {Array} relationships - Detected relationships
   * @param {Array} tables - Original table data
   * @returns {Promise<Array>} Relationships with confidence scores
   */
  async calculateConfidenceLevels(relationships, tables) {
    const relationshipsWithConfidence = [];
    
    for (const relationship of relationships) {
      let confidence = 0;
      const factors = [];
      
      // Factor 1: Data completeness (higher confidence for more complete data)
      const completenessScore = 1 - relationship.statistics.nullPercentage;
      confidence += completenessScore * 0.3;
      factors.push({ factor: 'Data Completeness', score: completenessScore, weight: 0.3 });
      
      // Factor 2: Sample size adequacy
      const sampleSize = relationship.statistics.singleValueCount + relationship.statistics.multiValueCount;
      const sampleScore = Math.min(sampleSize / this.MIN_SAMPLE_SIZE, 1);
      confidence += sampleScore * 0.2;
      factors.push({ factor: 'Sample Size', score: sampleScore, weight: 0.2 });
      
      // Factor 3: Pattern consistency (how consistent is the relationship type)
      let consistencyScore = 0;
      if (relationship.type === 'one-to-one') {
        consistencyScore = relationship.dataEvidence.singleReferencePercentage;
      } else if (relationship.type === 'one-to-many') {
        // Good mix of single and multiple references
        const balance = Math.min(
          relationship.dataEvidence.singleReferencePercentage,
          relationship.dataEvidence.multipleReferencePercentage
        );
        consistencyScore = balance * 2; // Boost balanced patterns
      } else { // many-to-many
        consistencyScore = relationship.dataEvidence.multipleReferencePercentage;
      }
      confidence += consistencyScore * 0.3;
      factors.push({ factor: 'Pattern Consistency', score: consistencyScore, weight: 0.3 });
      
      // Factor 4: Cross-table validation (check if referenced IDs actually exist)
      const validationScore = await this.validateCrossTableReferences(relationship, tables);
      confidence += validationScore * 0.2;
      factors.push({ factor: 'Cross-table Validation', score: validationScore, weight: 0.2 });
      
      // Ensure confidence is between 0 and 1
      confidence = Math.max(0, Math.min(1, confidence));
      
      relationshipsWithConfidence.push({
        ...relationship,
        confidence,
        confidenceFactors: factors,
        recommendation: confidence >= this.CONFIDENCE_THRESHOLD ? 'auto-suggest' : 'manual-review'
      });
    }
    
    return relationshipsWithConfidence;
  }

  /**
   * Validates that referenced IDs in relationships actually exist in target tables.
   * This cross-table validation helps determine confidence in relationship detection.
   * 
   * @param {Object} relationship - Relationship to validate
   * @param {Array} tables - All table data
   * @returns {Promise<number>} Validation score (0-1)
   */
  async validateCrossTableReferences(relationship, tables) {
    try {
      // Find source and target tables
      const sourceTable = tables.find(t => t.name === relationship.sourceTable);
      const targetTable = tables.find(t => t.name === relationship.targetTable);
      
      if (!sourceTable || !targetTable) {
        return 0; // Can't validate if tables not found
      }
      
      // Get all referenced IDs from source table
      const referencedIds = new Set();
      sourceTable.records.forEach(record => {
        const fieldValue = record.fields[relationship.sourceField];
        if (Array.isArray(fieldValue)) {
          fieldValue.forEach(id => {
            if (id && typeof id === 'string') {
              referencedIds.add(id);
            }
          });
        }
      });
      
      // Get all available IDs from target table
      const availableIds = new Set();
      targetTable.records.forEach(record => {
        if (record.id) {
          availableIds.add(record.id);
        }
      });
      
      // Calculate validation score
      let validReferences = 0;
      for (const refId of referencedIds) {
        if (availableIds.has(refId)) {
          validReferences++;
        }
      }
      
      const validationScore = referencedIds.size > 0 ? validReferences / referencedIds.size : 0;
      console.log(`Cross-table validation for ${relationship.sourceTable}.${relationship.sourceField} -> ${relationship.targetTable}: ${validationScore.toFixed(2)}`);
      
      return validationScore;
    } catch (error) {
      console.error(`Cross-table validation failed for relationship ${relationship.sourceTable}.${relationship.sourceField}:`, error.message);
      return 0;
    }
  }

  /**
   * Generates user-friendly recommendations based on relationship analysis.
   * Includes confidence levels, suggested actions, and FK placement recommendations.
   * 
   * @param {Array} relationships - Relationships with confidence scores
   * @returns {Promise<Object>} User recommendations
   */
  async generateRecommendations(relationships) {
    const recommendations = {
      highConfidence: [],
      lowConfidence: [],
      autoSuggestions: [],
      manualReview: [],
      foreignKeyPlacements: []
    };
    
    for (const relationship of relationships) {
      const recommendation = {
        relationship,
        action: relationship.confidence >= this.CONFIDENCE_THRESHOLD ? 'Auto-suggest with confirmation' : 'Manual review required',
        reasoning: this.generateReasoningText(relationship),
        suggestedForeignKey: this.suggestForeignKeyPlacement(relationship)
      };
      
      // Categorize recommendations
      if (relationship.confidence >= this.CONFIDENCE_THRESHOLD) {
        recommendations.highConfidence.push(recommendation);
        recommendations.autoSuggestions.push(recommendation);
      } else {
        recommendations.lowConfidence.push(recommendation);
        recommendations.manualReview.push(recommendation);
      }
      
      // Add FK placement recommendation
      recommendations.foreignKeyPlacements.push(recommendation.suggestedForeignKey);
    }
    
    return recommendations;
  }

  /**
   * Generates human-readable reasoning for relationship recommendations.
   * Explains why the system suggests a particular relationship type and confidence level.
   * 
   * @param {Object} relationship - Relationship with confidence data
   * @returns {string} Human-readable reasoning text
   */
  generateReasoningText(relationship) {
    const stats = relationship.dataEvidence;
    const confidence = (relationship.confidence * 100).toFixed(1);
    
    let reasoning = `Detected ${relationship.type} relationship with ${confidence}% confidence. `;
    
    // Add specific reasoning based on relationship type
    if (relationship.type === 'one-to-one') {
      reasoning += `Most records (${(stats.singleReferencePercentage * 100).toFixed(1)}%) have exactly one reference, indicating a one-to-one relationship.`;
    } else if (relationship.type === 'one-to-many') {
      reasoning += `Mixed pattern with ${(stats.singleReferencePercentage * 100).toFixed(1)}% single references and ${(stats.multipleReferencePercentage * 100).toFixed(1)}% multiple references, suggesting one-to-many relationship.`;
    } else {
      reasoning += `Predominantly multiple references (${(stats.multipleReferencePercentage * 100).toFixed(1)}%) with average ${stats.avgReferencesPerRecord.toFixed(1)} references per record, indicating many-to-many relationship.`;
    }
    
    // Add confidence factors
    const topFactor = relationship.confidenceFactors.reduce((prev, current) => 
      (prev.score * prev.weight) > (current.score * current.weight) ? prev : current
    );
    reasoning += ` Primary confidence factor: ${topFactor.factor} (${(topFactor.score * 100).toFixed(1)}%).`;
    
    return reasoning;
  }

  /**
   * Suggests foreign key placement following the rule of keeping FK on the "many" side.
   * Analyzes relationship cardinality to determine optimal FK placement.
   * 
   * @param {Object} relationship - Relationship to analyze
   * @returns {Object} Foreign key placement recommendation
   */
  suggestForeignKeyPlacement(relationship) {
    let placement = {
      foreignKeyTable: null,
      foreignKeyColumn: null,
      referencesTable: null,
      referencesColumn: 'id',
      junctionTable: null,
      reasoning: ''
    };
    
    if (relationship.type === 'one-to-one') {
      // For one-to-one, place FK on either side (we'll choose source for simplicity)
      placement.foreignKeyTable = relationship.sourceTable;
      placement.foreignKeyColumn = `${relationship.targetTable}_id`;
      placement.referencesTable = relationship.targetTable;
      placement.reasoning = 'One-to-one relationship: FK placed on source table for simplicity.';
    } else if (relationship.type === 'one-to-many') {
      // FK goes on the "many" side (source table has the array, so it's the "many" side)
      placement.foreignKeyTable = relationship.sourceTable;
      placement.foreignKeyColumn = `${relationship.targetTable}_id`;
      placement.referencesTable = relationship.targetTable;
      placement.reasoning = 'One-to-many relationship: FK placed on the "many" side (source table).';
    } else { // many-to-many
      // Create junction table for many-to-many relationships
      const junctionTableName = `${relationship.sourceTable}_${relationship.targetTable}`;
      placement.junctionTable = {
        name: junctionTableName,
        columns: [
          { name: `${relationship.sourceTable}_id`, references: relationship.sourceTable },
          { name: `${relationship.targetTable}_id`, references: relationship.targetTable }
        ]
      };
      placement.reasoning = 'Many-to-many relationship: Junction table created to maintain referential integrity.';
    }
    
    return placement;
  }

  /**
   * Helper method to infer field type from a sample value.
   * Used for basic field categorization during pattern analysis.
   * 
   * @param {*} value - Sample field value
   * @returns {string} Inferred field type
   */
  inferFieldType(value) {
    if (value === null || value === undefined) return 'null';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (value instanceof Date) return 'date';
    return 'object';
  }

  /**
   * Helper method to identify which table a referenced ID belongs to.
   * Uses pattern matching and cross-referencing with available tables.
   * 
   * @param {string} id - Referenced ID to identify
   * @param {Array} tables - All available tables
   * @returns {string|null} Table name or null if not found
   */
  identifyReferencedTable(id, tables) {
    // Try to find the table that contains this ID
    for (const table of tables) {
      const hasId = table.records.some(record => record.id === id);
      if (hasId) {
        return table.name;
      }
    }
    return null;
  }
}

module.exports = DataPatternAnalyzer;