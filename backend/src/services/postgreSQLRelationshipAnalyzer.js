/**
 * PostgreSQL Relationship Analyzer
 * 
 * Analyzes relationships from imported PostgreSQL data instead of Airtable samples.
 * This provides more accurate relationship detection since it works with the complete dataset
 * and can perform comprehensive statistical analysis on actual database records.
 */

class PostgreSQLRelationshipAnalyzer {
  constructor(db) {
    this.db = db;
  }

  /**
   * Analyze relationships from imported PostgreSQL data.
   * This is the main analysis method that coordinates different analysis approaches.
   * 
   * @param {Array} tables - Table information from schema discovery
   * @param {Function} progressCallback - Progress reporting callback
   * @returns {Promise<Object>} Relationship analysis results
   */
  async analyzeRelationshipsFromDB(tables, progressCallback = null) {
    this.emitProgress('🔍 Starting PostgreSQL relationship analysis...', 'analyzing-relationships', progressCallback);
    this.emitProgress('💾 Data source: Imported PostgreSQL data (complete dataset)', 'analyzing-relationships', progressCallback);
    
    try {
      // Step 1: Schema-based relationship detection
      this.emitProgress('📋 Analyzing schema relationships...', 'pattern-analysis', progressCallback);
      const schemaRelationships = await this.analyzeSchemaRelationships(tables, progressCallback);
      
      // Step 2: Data pattern analysis on PostgreSQL data
      this.emitProgress('📊 Analyzing data patterns in PostgreSQL...', 'pattern-analysis', progressCallback);
      const dataPatternRelationships = await this.analyzeDataPatterns(tables, progressCallback);
      
      // Step 3: Combine schema and data analysis
      this.emitProgress('🔀 Combining analysis results...', 'pattern-analysis', progressCallback);
      const combinedAnalysis = await this.combineAnalysisResults(schemaRelationships, dataPatternRelationships, progressCallback);
      
      this.emitProgress('✅ PostgreSQL relationship analysis complete', 'pattern-complete', progressCallback);
      return combinedAnalysis;
      
    } catch (error) {
      console.error('PostgreSQL relationship analysis failed:', error.message);
      this.emitProgress(`❌ Analysis failed: ${error.message}`, 'pattern-error', progressCallback);
      throw new Error(`PostgreSQL relationship analysis error: ${error.message}`);
    }
  }

  /**
   * Analyze schema-based relationships from table structures.
   * This identifies explicit relationships from Airtable linked record fields.
   */
  async analyzeSchemaRelationships(tables, progressCallback = null) {
    this.emitProgress('🏗️ Analyzing schema-based relationships...', 'pattern-analysis', progressCallback);
    
    const relationships = [];
    let processedTables = 0;
    
    for (const table of tables) {
      processedTables++;
      this.emitProgress(`   📋 [${processedTables}/${tables.length}] Analyzing schema for: ${table.name}`, 'pattern-analysis', progressCallback);
      
      if (!table.fields) continue;
      
      for (const field of table.fields) {
        if (field.type === 'multipleRecordLinks') {
          // Find target table
          const targetTable = tables.find(t => t.id === field.options?.linkedTableId);
          
          if (targetTable) {
            const relationship = {
              sourceTable: table.name,
              sourceField: field.name,
              targetTable: targetTable.name,
              type: 'one-to-many', // Default assumption
              confidence: 0.75, // High confidence for schema-defined relationships
              source: 'schema',
              reasoning: 'Explicit multipleRecordLinks field in Airtable schema',
              schemaEvidence: {
                fieldType: field.type,
                linkedTableId: field.options?.linkedTableId,
                isSymmetric: field.options?.isReversed || false
              }
            };
            
            relationships.push(relationship);
            this.emitProgress(`      ✅ Found schema relationship: ${table.name}.${field.name} → ${targetTable.name}`, 'pattern-analysis', progressCallback);
          }
        }
      }
    }
    
    this.emitProgress(`✅ Schema analysis complete: ${relationships.length} relationships found`, 'pattern-analysis', progressCallback);
    return relationships;
  }

  /**
   * Analyze data patterns in PostgreSQL tables.
   * This performs statistical analysis on actual imported data.
   */
  async analyzeDataPatterns(tables, progressCallback = null) {
    this.emitProgress('📊 Analyzing data patterns in PostgreSQL...', 'pattern-analysis', progressCallback);
    
    const relationships = [];
    const tableNames = tables.map(t => t.name.toLowerCase().replace(/[^a-z0-9]/g, '_'));
    
    let processedPairs = 0;
    const totalPairs = tableNames.length * (tableNames.length - 1);
    
    // Analyze each table pair for potential relationships
    for (let i = 0; i < tableNames.length; i++) {
      for (let j = 0; j < tableNames.length; j++) {
        if (i === j) continue;
        
        processedPairs++;
        if (processedPairs % 10 === 0) {
          const progressPercent = (processedPairs / totalPairs * 100).toFixed(1);
          this.emitProgress(`   🔍 Analyzing table pairs: ${processedPairs}/${totalPairs} (${progressPercent}%)`, 'pattern-analysis', progressCallback);
        }
        
        const sourceTable = tableNames[i];
        const targetTable = tableNames[j];
        
        try {
          // Look for potential foreign key relationships
          const potentialRelationships = await this.findPotentialForeignKeys(sourceTable, targetTable, progressCallback);
          relationships.push(...potentialRelationships);
          
        } catch (error) {
          // Continue analysis even if one table pair fails
          console.warn(`Failed to analyze ${sourceTable} → ${targetTable}:`, error.message);
        }
      }
    }
    
    this.emitProgress(`✅ Data pattern analysis complete: ${relationships.length} patterns detected`, 'pattern-analysis', progressCallback);
    return relationships;
  }

  /**
   * Find potential foreign key relationships between two PostgreSQL tables.
   * Uses statistical analysis of actual data to detect relationships.
   */
  async findPotentialForeignKeys(sourceTable, targetTable, progressCallback = null) {
    const relationships = [];
    
    try {
      // Get column information for both tables
      const sourceColumns = await this.getTableColumns(sourceTable);
      const targetColumns = await this.getTableColumns(targetTable);
      
      // Look for potential foreign key columns in source table
      for (const sourceColumn of sourceColumns) {
        // Skip primary key and system columns
        if (sourceColumn.column_name === 'id' || sourceColumn.column_name.startsWith('_')) {
          continue;
        }
        
        // Check if this column might reference the target table's primary key
        const relationshipAnalysis = await this.analyzeColumnRelationship(
          sourceTable, sourceColumn.column_name,
          targetTable, 'id',
          progressCallback
        );
        
        if (relationshipAnalysis.isLikelyForeignKey) {
          const relationship = {
            sourceTable,
            sourceField: sourceColumn.column_name,
            targetTable,
            targetField: 'id',
            type: relationshipAnalysis.relationshipType,
            confidence: relationshipAnalysis.confidence,
            source: 'data_analysis',
            reasoning: relationshipAnalysis.reasoning,
            dataEvidence: relationshipAnalysis.evidence
          };
          
          relationships.push(relationship);
        }
      }
      
    } catch (error) {
      console.warn(`Failed to analyze FK relationship ${sourceTable} → ${targetTable}:`, error.message);
    }
    
    return relationships;
  }

  /**
   * Analyze the relationship between two specific columns using statistical methods.
   */
  async analyzeColumnRelationship(sourceTable, sourceColumn, targetTable, targetColumn, progressCallback = null) {
    try {
      // Get sample of values from both columns
      const sourceQuery = `SELECT DISTINCT ${sourceColumn} FROM ${sourceTable} WHERE ${sourceColumn} IS NOT NULL LIMIT 1000`;
      const targetQuery = `SELECT DISTINCT ${targetColumn} FROM ${targetTable} WHERE ${targetColumn} IS NOT NULL LIMIT 1000`;
      
      const [sourceResult, targetResult] = await Promise.all([
        this.db.query(sourceQuery),
        this.db.query(targetQuery)
      ]);
      
      const sourceValues = new Set(sourceResult.rows.map(row => String(row[sourceColumn])));
      const targetValues = new Set(targetResult.rows.map(row => String(row[targetColumn])));
      
      // Calculate overlap statistics
      const intersection = new Set([...sourceValues].filter(x => targetValues.has(x)));
      const matchRatio = intersection.size / sourceValues.size;
      const coverageRatio = intersection.size / targetValues.size;
      
      // Determine if this is likely a foreign key relationship
      const isLikelyForeignKey = matchRatio >= 0.5 && intersection.size >= 3;
      
      let confidence = 0;
      let relationshipType = 'manual-review';
      let reasoning = 'Statistical analysis inconclusive';
      
      if (isLikelyForeignKey) {
        // Calculate confidence based on match statistics
        confidence = Math.min(0.95, matchRatio * 0.8 + coverageRatio * 0.2);
        
        // Determine relationship type based on cardinality
        if (matchRatio > 0.9 && coverageRatio > 0.9) {
          relationshipType = 'one-to-one';
          reasoning = `High overlap (${(matchRatio*100).toFixed(1)}% match, ${(coverageRatio*100).toFixed(1)}% coverage) suggests 1:1 relationship`;
        } else if (matchRatio > 0.7) {
          relationshipType = 'many-to-one';
          reasoning = `Good overlap (${(matchRatio*100).toFixed(1)}% match) suggests M:1 relationship`;
        } else {
          relationshipType = 'one-to-many';
          reasoning = `Moderate overlap (${(matchRatio*100).toFixed(1)}% match) suggests 1:M relationship`;
        }
      }
      
      return {
        isLikelyForeignKey,
        confidence,
        relationshipType,
        reasoning,
        evidence: {
          sourceValues: sourceValues.size,
          targetValues: targetValues.size,
          matchingValues: intersection.size,
          matchRatio,
          coverageRatio
        }
      };
      
    } catch (error) {
      return {
        isLikelyForeignKey: false,
        confidence: 0,
        relationshipType: 'manual-review',
        reasoning: `Analysis failed: ${error.message}`,
        evidence: { error: error.message }
      };
    }
  }

  /**
   * Get column information for a PostgreSQL table.
   */
  async getTableColumns(tableName) {
    const query = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `;
    
    const result = await this.db.query(query, [tableName]);
    return result.rows;
  }

  /**
   * Combine schema-based and data pattern analysis results.
   */
  async combineAnalysisResults(schemaRelationships, dataPatternRelationships, progressCallback = null) {
    this.emitProgress('🔀 Combining schema and data analysis results...', 'pattern-analysis', progressCallback);
    
    const combinedRelationships = [];
    const processedPairs = new Set();
    
    // Start with schema relationships and enhance with data patterns
    for (const schemaRel of schemaRelationships) {
      const key = `${schemaRel.sourceTable}.${schemaRel.sourceField}->${schemaRel.targetTable}`;
      processedPairs.add(key);
      
      // Look for matching data pattern
      const dataPattern = dataPatternRelationships.find(dp => 
        dp.sourceTable === schemaRel.sourceTable &&
        dp.sourceField === schemaRel.sourceField &&
        dp.targetTable === schemaRel.targetTable
      );
      
      if (dataPattern) {
        // Enhance with data pattern analysis
        const enhancedRelationship = {
          ...schemaRel,
          confidence: Math.max(schemaRel.confidence, dataPattern.confidence), // Take higher confidence
          hybridAnalysis: true,
          schemaEvidence: schemaRel.schemaEvidence,
          dataEvidence: dataPattern.dataEvidence,
          reasoning: `${schemaRel.reasoning} + Data pattern analysis confirms relationship`
        };
        
        combinedRelationships.push(enhancedRelationship);
        this.emitProgress(`   ✅ Enhanced: ${key} (confidence: ${(enhancedRelationship.confidence*100).toFixed(1)}%)`, 'pattern-analysis', progressCallback);
      } else {
        // Schema-only relationship
        combinedRelationships.push({
          ...schemaRel,
          hybridAnalysis: false
        });
        this.emitProgress(`   📋 Schema-only: ${key} (confidence: ${(schemaRel.confidence*100).toFixed(1)}%)`, 'pattern-analysis', progressCallback);
      }
    }
    
    // Add data-only relationships that weren't found in schema
    for (const dataRel of dataPatternRelationships) {
      const key = `${dataRel.sourceTable}.${dataRel.sourceField}->${dataRel.targetTable}`;
      
      if (!processedPairs.has(key)) {
        combinedRelationships.push({
          ...dataRel,
          hybridAnalysis: false,
          source: 'data_only'
        });
        this.emitProgress(`   📊 Data-only: ${key} (confidence: ${(dataRel.confidence*100).toFixed(1)}%)`, 'pattern-analysis', progressCallback);
      }
    }
    
    // Generate analysis summary
    const analysis = {
      totalRelationships: combinedRelationships.length,
      highConfidenceCount: combinedRelationships.filter(r => r.confidence >= 0.7).length,
      lowConfidenceCount: combinedRelationships.filter(r => r.confidence < 0.7).length,
      schemaBasedCount: schemaRelationships.length,
      dataEnhancedCount: combinedRelationships.filter(r => r.hybridAnalysis).length,
      dataOnlyCount: combinedRelationships.filter(r => r.source === 'data_only').length
    };
    
    // Generate recommendations
    const recommendations = {
      highConfidence: combinedRelationships.filter(r => r.confidence >= 0.7),
      lowConfidence: combinedRelationships.filter(r => r.confidence < 0.7),
      autoSuggestions: combinedRelationships.filter(r => r.confidence >= 0.8),
      manualReview: combinedRelationships.filter(r => r.confidence < 0.5)
    };
    
    this.emitProgress(`✅ Analysis combination complete: ${analysis.totalRelationships} total, ${analysis.highConfidenceCount} high confidence`, 'pattern-analysis', progressCallback);
    
    return {
      relationships: combinedRelationships,
      analysis,
      recommendations,
      source: 'postgresql_analysis'
    };
  }

  /**
   * Helper method to emit progress updates.
   */
  emitProgress(message, status, progressCallback, additionalData = {}) {
    if (progressCallback) {
      progressCallback({
        status,
        message,
        timestamp: new Date().toISOString(),
        ...additionalData
      });
    }
  }
}

module.exports = PostgreSQLRelationshipAnalyzer;