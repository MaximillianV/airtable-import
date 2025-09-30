/**
 * Cardinality-Based Relationship Analyzer
 * 
 * Enhanced relationship analyzer that uses PostgreSQL's analyze_relationships function
 * to perform accurate cardinality analysis and generate confidence scores based on
 * actual data patterns rather than heuristics.
 * 
 * This approach is superior because it:
 * - Analyzes actual cardinality patterns (one-to-one, one-to-many, etc.)
 * - Uses database-driven analysis for accuracy
 * - Provides standardized relationship type detection
 * - Works with both array and scalar field types
 */

const ImportDatabaseService = require('./importDatabase');

class CardinalityRelationshipAnalyzer {
  constructor() {
    this.importDb = null;
    this.analysisResults = null;
  }

  /**
   * Analyzes relationships using PostgreSQL cardinality analysis function
   * @param {ImportDatabaseService} importDb - Connected database service
   * @param {Object} importMetadata - Metadata from the import process
   * @returns {Object} Enhanced Relationship Analysis Report
   */
  async analyzeRelationships(importDb, importMetadata) {
    console.log('🔍 Starting cardinality-based relationship analysis...');
    
    this.importDb = importDb;
    
    try {
      // Discover all potential relationships from imported tables
      const relationshipSpecs = await this.discoverPotentialRelationships();
      console.log(`   📊 Discovered ${relationshipSpecs.length} potential relationships to analyze`);

      if (relationshipSpecs.length === 0) {
        console.log('   ℹ️  No relationships found to analyze');
        return this.generateEmptyReport();
      }

      // Use PostgreSQL analyze_relationships function for cardinality analysis
      const cardinalityResults = await this.analyzeCardinality(relationshipSpecs);
      console.log(`   🎯 Analyzed cardinality for ${cardinalityResults.length} relationships`);

      // Generate confidence scores and relationship proposals
      const relationshipProposals = this.generateRelationshipProposals(cardinalityResults, relationshipSpecs);

      // Create comprehensive analysis report
      const report = {
        analysisId: `cardinality-analysis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        method: 'cardinality-based',
        totalRelationshipsAnalyzed: relationshipProposals.length,
        relationships: relationshipProposals.map(proposal => ({
          fromTable: proposal.fromTable,
          fromField: proposal.fromField,
          toTable: proposal.toTable,
          relationshipType: proposal.relationshipType,
          cardinality: {
            maxFromSide: proposal.maxLinksFrom,
            maxToSide: proposal.maxLinksTo
          },
          confidence: proposal.confidence,
          confidenceFactors: proposal.confidenceFactors,
          reviewRequired: proposal.confidence < 0.8,
          errorMessage: proposal.errorMessage || null
        })),
        summary: {
          highConfidence: relationshipProposals.filter(r => r.confidence >= 0.8).length,
          mediumConfidence: relationshipProposals.filter(r => r.confidence >= 0.6 && r.confidence < 0.8).length,
          lowConfidence: relationshipProposals.filter(r => r.confidence < 0.6).length,
          errors: relationshipProposals.filter(r => r.errorMessage).length
        }
      };

      console.log('✅ Cardinality-based relationship analysis complete');
      console.log(`   🎯 Results: ${report.summary.highConfidence} high confidence, ${report.summary.mediumConfidence} medium confidence, ${report.summary.lowConfidence} low confidence`);
      console.log(`   ❌ Errors: ${report.summary.errors} failed analyses`);

      return report;

    } catch (error) {
      console.error('❌ Cardinality relationship analysis failed:', error.message);
      throw new Error(`Cardinality relationship analysis failed: ${error.message}`);
    }
  }

  /**
   * Discovers potential relationships by examining imported table schemas
   * @returns {Array} Array of relationship specifications for analysis
   */
  async discoverPotentialRelationships() {
    console.log('   🔍 Discovering potential relationships from table schemas...');
    
    const relationships = [];
    
    // Get all tables in the data schema
    const tables = await this.importDb.executeSQL(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'data'
      ORDER BY table_name
    `);

    const tableNames = tables.rows || tables;

    // Examine each table for link fields (array columns and potential foreign keys)
    for (const tableRow of tableNames) {
      const tableName = tableRow.table_name;
      
      // Get column information for this table
      const columns = await this.importDb.executeSQL(`
        SELECT 
          column_name,
          data_type,
          udt_name
        FROM information_schema.columns 
        WHERE table_schema = 'data' 
        AND table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);

      const tableColumns = columns.rows || columns;

      for (const column of tableColumns) {
        // Check for array fields (likely Airtable multipleRecordLinks)
        if (column.data_type === 'ARRAY' || column.udt_name === '_text') {
          // This is an array field - potential relationship
          const fieldName = column.column_name;
          
          // Try to determine target table from field name or content analysis
          const targetTable = await this.inferTargetTable(tableName, fieldName, tableNames);
          
          if (targetTable) {
            relationships.push({
              fromTable: tableName,
              fromField: fieldName,
              toTable: targetTable,
              fieldType: 'array'
            });
          }
        }
        
        // Check for potential foreign key fields (scalar fields ending in _id, etc.)
        if (this.isPotentialForeignKey(column.column_name) && column.data_type === 'text') {
          const fieldName = column.column_name;
          const targetTable = await this.inferTargetTableFromForeignKey(fieldName, tableNames);
          
          if (targetTable) {
            relationships.push({
              fromTable: tableName,
              fromField: fieldName,
              toTable: targetTable,
              fieldType: 'scalar'
            });
          }
        }
      }
    }

    console.log(`   📋 Found ${relationships.length} potential relationships across ${tableNames.length} tables`);
    return relationships;
  }

  /**
   * Uses PostgreSQL analyze_relationships function to perform cardinality analysis
   * @param {Array} relationshipSpecs - Array of relationship specifications
   * @returns {Array} Cardinality analysis results
   */
  async analyzeCardinality(relationshipSpecs) {
    console.log('   🔬 Running PostgreSQL cardinality analysis...');
    
    // Convert relationship specs to JSON format for the PostgreSQL function
    const relationshipsJson = JSON.stringify(relationshipSpecs);
    
    try {
      // Call the analyze_relationships function in the data schema
      const results = await this.importDb.executeSQL(
        'SELECT * FROM data.analyze_relationships($1::jsonb)',
        [relationshipsJson]
      );

      const cardinalityResults = results.rows || results;
      console.log(`   📊 PostgreSQL function analyzed ${cardinalityResults.length} relationships`);
      
      return cardinalityResults;
    } catch (error) {
      console.error('   ❌ PostgreSQL cardinality analysis failed:', error.message);
      throw new Error(`Cardinality analysis failed: ${error.message}`);
    }
  }

  /**
   * Generates relationship proposals with confidence scores based on cardinality results
   * @param {Array} cardinalityResults - Results from PostgreSQL analyze_relationships function
   * @param {Array} originalSpecs - Original relationship specifications
   * @returns {Array} Enhanced relationship proposals with confidence scores
   */
  generateRelationshipProposals(cardinalityResults, originalSpecs) {
    console.log('   🎯 Generating confidence scores for relationship proposals...');
    
    const proposals = [];

    for (const result of cardinalityResults) {
      // Find the original spec for additional context
      const originalSpec = originalSpecs.find(spec => 
        spec.fromTable === result.from_table && 
        spec.fromField === result.from_field &&
        spec.toTable === result.to_table
      );

      if (result.error_message) {
        // Handle analysis errors (table/column not found, etc.)
        proposals.push({
          fromTable: result.from_table,
          fromField: result.from_field,
          toTable: result.to_table,
          relationshipType: 'error',
          maxLinksFrom: 0,
          maxLinksTo: 0,
          confidence: 0.0,
          confidenceFactors: {
            error: result.error_message,
            cardinalityAnalysis: false
          },
          errorMessage: result.error_message,
          fieldType: originalSpec?.fieldType || 'unknown'
        });
        continue;
      }

      // Calculate confidence score based on cardinality analysis results
      const confidence = this.calculateCardinalityBasedConfidence(result, originalSpec);
      
      proposals.push({
        fromTable: result.from_table,
        fromField: result.from_field,
        toTable: result.to_table,
        relationshipType: result.relationship_type,
        maxLinksFrom: parseInt(result.max_links_from) || 0,
        maxLinksTo: parseInt(result.max_links_to) || 0,
        confidence: confidence.score,
        confidenceFactors: confidence.factors,
        fieldType: originalSpec?.fieldType || 'unknown'
      });
    }

    return proposals;
  }

  /**
   * Calculates confidence score based on cardinality analysis results
   * This is superior to heuristic approaches because it's based on actual data patterns
   * @param {Object} cardinalityResult - Result from analyze_relationships function
   * @param {Object} originalSpec - Original relationship specification
   * @returns {Object} Confidence score and factors
   */
  calculateCardinalityBasedConfidence(cardinalityResult, originalSpec) {
    let score = 0.3; // Base confidence for successful cardinality analysis
    const factors = {};

    // Factor 1: Clear cardinality pattern detection (40% weight)
    const relationshipType = cardinalityResult.relationship_type;
    const maxFrom = parseInt(cardinalityResult.max_links_from) || 0;
    const maxTo = parseInt(cardinalityResult.max_links_to) || 0;

    if (relationshipType && relationshipType !== 'error') {
      // Clear relationship type detected
      score += 0.4;
      factors.cardinalityPattern = 'clear';
      
      // Bonus for well-defined patterns
      if (relationshipType === 'one-to-one' && maxFrom === 1 && maxTo === 1) {
        score += 0.1;
        factors.patternClarity = 'perfect-one-to-one';
      } else if (relationshipType === 'one-to-many' && maxFrom === 1 && maxTo > 1) {
        score += 0.1;
        factors.patternClarity = 'clear-one-to-many';
      } else if (relationshipType === 'many-to-one' && maxFrom > 1 && maxTo === 1) {
        score += 0.1;
        factors.patternClarity = 'clear-many-to-one';
      } else if (relationshipType === 'many-to-many' && maxFrom > 1 && maxTo > 1) {
        score += 0.05; // Many-to-many is more complex, lower bonus
        factors.patternClarity = 'many-to-many';
      }
    } else {
      factors.cardinalityPattern = 'unclear';
    }

    // Factor 2: Field type appropriateness (20% weight)
    if (originalSpec?.fieldType) {
      if (originalSpec.fieldType === 'array' && (maxFrom > 1 || relationshipType.includes('many'))) {
        score += 0.2;
        factors.fieldTypeMatch = 'array-supports-multiple';
      } else if (originalSpec.fieldType === 'scalar' && maxFrom <= 1) {
        score += 0.2;
        factors.fieldTypeMatch = 'scalar-supports-single';
      } else {
        score += 0.1;
        factors.fieldTypeMatch = 'partial';
      }
    }

    // Factor 3: Data volume confidence (10% weight)
    if (maxFrom > 0 && maxTo > 0) {
      score += 0.1;
      factors.dataVolume = 'has-relationships';
    } else {
      factors.dataVolume = 'no-relationships-found';
    }

    // Ensure score stays within bounds
    score = Math.min(1.0, Math.max(0.0, score));

    return {
      score: parseFloat(score.toFixed(3)),
      factors
    };
  }

  /**
   * Infers target table from array field name and available tables
   */
  async inferTargetTable(tableName, fieldName, availableTableNames) {
    // Simple heuristic: look for table name that matches field name
    const tableNames = availableTableNames.map(row => row.table_name);
    
    // Try exact match first
    if (tableNames.includes(fieldName)) {
      return fieldName;
    }
    
    // Try pluralization patterns
    const singularField = fieldName.endsWith('s') ? fieldName.slice(0, -1) : fieldName;
    if (tableNames.includes(singularField)) {
      return singularField;
    }
    
    const pluralField = fieldName + 's';
    if (tableNames.includes(pluralField)) {
      return pluralField;
    }
    
    // Could add more sophisticated matching here
    return null;
  }

  /**
   * Checks if a column name looks like a foreign key
   */
  isPotentialForeignKey(columnName) {
    return columnName.endsWith('_id') || 
           columnName.endsWith('Id') ||
           columnName.includes('_ref') ||
           columnName.includes('_key');
  }

  /**
   * Infers target table from foreign key field name
   */
  async inferTargetTableFromForeignKey(fieldName, availableTableNames) {
    const tableNames = availableTableNames.map(row => row.table_name);
    
    // Remove common suffixes to get base name
    let baseName = fieldName
      .replace(/_id$/, '')
      .replace(/Id$/, '')
      .replace(/_ref$/, '')
      .replace(/_key$/, '');
    
    // Try the base name and its plural
    if (tableNames.includes(baseName)) {
      return baseName;
    }
    
    const pluralName = baseName + 's';
    if (tableNames.includes(pluralName)) {
      return pluralName;
    }
    
    return null;
  }

  /**
   * Generates an empty report when no relationships are found
   */
  generateEmptyReport() {
    return {
      analysisId: `cardinality-analysis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      method: 'cardinality-based',
      totalRelationshipsAnalyzed: 0,
      relationships: [],
      summary: {
        highConfidence: 0,
        mediumConfidence: 0,
        lowConfidence: 0,
        errors: 0
      }
    };
  }
}

module.exports = CardinalityRelationshipAnalyzer;