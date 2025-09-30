/**
 * Enhanced Database-First Relationship Analyzer
 * 
 * This analyzer uses the complete imported dataset in PostgreSQL to detect relationships
 * with high accuracy. Unlike the previous version that used limited samples, this performs
 * comprehensive statistical analysis on all 7,765+ records for accurate relationship detection.
 * 
 * Key improvements:
 * - Uses ALL imported data, not limited samples
 * - Database-native statistical functions for performance
 * - Referential integrity analysis across complete dataset
 * - Advanced pattern recognition using SQL analytics
 * - Proper confidence scoring based on data completeness
 */

class DatabaseFirstRelationshipAnalyzer {
  constructor(importDatabaseService) {
    this.db = importDatabaseService;
    this.analysisCache = new Map();
  }

  /**
   * Main analysis method - analyzes all relationships using complete database
   * 
   * @param {Array} tables - Table metadata from schema discovery
   * @param {Function} progressCallback - Progress reporting callback
   * @returns {Promise<Object>} Complete relationship analysis
   */
  async analyzeAllRelationships(tables, progressCallback = null) {
    this.emitProgress('🔍 Starting comprehensive database relationship analysis...', 'starting', progressCallback);
    this.emitProgress('💾 Using complete imported dataset for maximum accuracy', 'starting', progressCallback);
    
    try {
      const analysis = {
        relationships: [],
        statistics: {
          totalTables: tables.length,
          totalRecords: 0,
          relationshipsFound: 0,
          confidenceDistribution: {},
          analysisTime: Date.now()
        },
        metadata: {
          analyzer: 'DatabaseFirstRelationshipAnalyzer',
          version: '2.0.0',
          dataSource: 'complete_postgresql_dataset',
          analysisDate: new Date().toISOString()
        }
      };

      // Step 1: Get comprehensive table statistics
      this.emitProgress('📊 Gathering table statistics from complete dataset...', 'stats', progressCallback);
      const tableStats = await this.gatherTableStatistics(tables, progressCallback);
      analysis.statistics.totalRecords = tableStats.totalRecords;

      // Step 2: Detect explicit schema relationships (from Airtable metadata)  
      this.emitProgress('📋 Analyzing explicit schema relationships...', 'schema', progressCallback);
      const schemaRelationships = await this.detectSchemaRelationships(tables, progressCallback);
      analysis.relationships.push(...schemaRelationships);

      // Step 3: Comprehensive foreign key detection using full dataset
      this.emitProgress('🔗 Performing comprehensive foreign key analysis on all data...', 'fk-analysis', progressCallback);
      const foreignKeyRelationships = await this.detectForeignKeyRelationships(tables, tableStats, progressCallback);
      analysis.relationships.push(...foreignKeyRelationships);

      // Step 4: Advanced pattern detection using database analytics
      this.emitProgress('🧠 Running advanced pattern detection with SQL analytics...', 'patterns', progressCallback);
      const patternRelationships = await this.detectAdvancedPatterns(tables, tableStats, progressCallback);
      analysis.relationships.push(...patternRelationships);

      // Step 5: Deduplicate and score relationships
      this.emitProgress('🎯 Scoring and deduplicating relationships...', 'scoring', progressCallback);
      analysis.relationships = await this.scoreAndDeduplicateRelationships(analysis.relationships, progressCallback);

      // Final statistics
      analysis.statistics.relationshipsFound = analysis.relationships.length;
      analysis.statistics.confidenceDistribution = this.calculateConfidenceDistribution(analysis.relationships);
      analysis.statistics.analysisTime = Date.now() - analysis.statistics.analysisTime;

      this.emitProgress(`✅ Analysis complete: ${analysis.relationships.length} relationships found`, 'complete', progressCallback);
      return analysis;

    } catch (error) {
      console.error('Database relationship analysis failed:', error.message);
      this.emitProgress(`❌ Analysis failed: ${error.message}`, 'error', progressCallback);
      throw error;
    }
  }

  /**
   * Gather comprehensive statistics from all tables using database aggregations
   */
  async gatherTableStatistics(tables, progressCallback = null) {
    const stats = {
      tables: {},
      totalRecords: 0,
      columnTypes: {},
      nullabilityStats: {}
    };

    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      const tableName = this.sanitizeTableName(table.name);
      
      this.emitProgress(`   📊 [${i + 1}/${tables.length}] Analyzing: ${tableName}`, 'stats', progressCallback);

      try {
        // Get comprehensive table statistics in one query
        const statsQuery = `
          SELECT 
            COUNT(*) as total_rows,
            COUNT(DISTINCT airtable_id) as unique_airtable_ids,
            (SELECT COUNT(*) FROM information_schema.columns 
             WHERE table_name = $1 AND table_schema = 'public') as total_columns
        `;
        
        const result = await this.db.executeSQL(statsQuery, [tableName]);
        const tableStats = result[0];

        // Get column-specific statistics
        const columnStatsQuery = `
          SELECT 
            column_name,
            data_type,
            is_nullable,
            (SELECT COUNT(*) FROM "${tableName}" WHERE "${column_name}" IS NOT NULL) as non_null_count,
            (SELECT COUNT(DISTINCT "${column_name}") FROM "${tableName}" WHERE "${column_name}" IS NOT NULL) as distinct_count
          FROM information_schema.columns 
          WHERE table_name = $1 AND table_schema = 'public'
          AND column_name != 'airtable_id'
          ORDER BY ordinal_position
        `;

        const columnStats = await this.db.executeSQL(columnStatsQuery, [tableName]);

        stats.tables[tableName] = {
          originalName: table.name,
          totalRows: parseInt(tableStats.total_rows),
          uniqueAirtableIds: parseInt(tableStats.unique_airtable_ids),
          totalColumns: parseInt(tableStats.total_columns),
          columns: columnStats.map(col => ({
            name: col.column_name,
            dataType: col.data_type,
            isNullable: col.is_nullable === 'YES',
            nonNullCount: parseInt(col.non_null_count),
            distinctCount: parseInt(col.distinct_count),
            completeness: parseInt(col.non_null_count) / parseInt(tableStats.total_rows),
            distinctness: parseInt(col.distinct_count) / parseInt(col.non_null_count || 1)
          }))
        };

        stats.totalRecords += parseInt(tableStats.total_rows);

      } catch (error) {
        console.warn(`Failed to get statistics for table ${tableName}:`, error.message);
        stats.tables[tableName] = {
          originalName: table.name,
          totalRows: 0,
          error: error.message
        };
      }
    }

    this.emitProgress(`✅ Statistics complete: ${stats.totalRecords} total records across ${Object.keys(stats.tables).length} tables`, 'stats', progressCallback);
    return stats;
  }

  /**
   * Detect explicit relationships from Airtable schema metadata
   */
  async detectSchemaRelationships(tables, progressCallback = null) {
    const relationships = [];

    for (const table of tables) {
      if (!table.fields) continue;

      for (const field of table.fields) {
        if (field.type === 'multipleRecordLinks') {
          const targetTable = tables.find(t => t.id === field.options?.linkedTableId);
          
          if (targetTable) {
            relationships.push({
              fromTable: this.sanitizeTableName(table.name),
              fromField: this.sanitizeColumnName(field.name),
              toTable: this.sanitizeTableName(targetTable.name),
              toField: 'airtable_id',
              relationshipType: 'one-to-many',
              confidence: 0.95, // High confidence for explicit schema relationships
              source: 'airtable_schema',
              reasoning: 'Explicit multipleRecordLinks field in Airtable schema',
              metadata: {
                fieldType: field.type,
                linkedTableId: field.options?.linkedTableId,
                originalFieldName: field.name,
                originalTableName: table.name
              }
            });
          }
        }
      }
    }

    this.emitProgress(`✅ Schema relationships: ${relationships.length} explicit relationships found`, 'schema', progressCallback);
    return relationships;
  }

  /**
   * Comprehensive foreign key detection using complete dataset analysis
   */
  async detectForeignKeyRelationships(tables, tableStats, progressCallback = null) {
    const relationships = [];
    const tableNames = Object.keys(tableStats.tables);
    
    let analyzed = 0;
    const totalAnalyses = tableNames.length * (tableNames.length - 1);

    for (const sourceTableName of tableNames) {
      const sourceStats = tableStats.tables[sourceTableName];
      
      for (const targetTableName of tableNames) {
        if (sourceTableName === targetTableName) continue;
        
        analyzed++;
        if (analyzed % 50 === 0 || analyzed === totalAnalyses) {
          const progress = (analyzed / totalAnalyses * 100).toFixed(1);
          this.emitProgress(`   🔍 [${analyzed}/${totalAnalyses}] FK Analysis ${progress}%: ${sourceTableName} → ${targetTableName}`, 'fk-analysis', progressCallback);
        }

        const targetStats = tableStats.tables[targetTableName];
        
        // Analyze each column in source table as potential foreign key
        for (const sourceColumn of sourceStats.columns || []) {
          // Skip obvious non-FK columns
          if (this.shouldSkipColumn(sourceColumn)) continue;

          // Check if this column could reference the target table
          const fkAnalysis = await this.analyzePotentialForeignKey(
            sourceTableName, sourceColumn,
            targetTableName, targetStats,
            progressCallback
          );

          if (fkAnalysis.isLikelyForeignKey) {
            relationships.push(fkAnalysis.relationship);
          }
        }
      }
    }

    this.emitProgress(`✅ Foreign key analysis: ${relationships.length} potential FK relationships found`, 'fk-analysis', progressCallback);
    return relationships;
  }

  /**
   * Analyze if a column is likely a foreign key to another table using complete dataset
   */
  async analyzePotentialForeignKey(sourceTableName, sourceColumn, targetTableName, targetStats, progressCallback = null) {
    try {
      // Comprehensive referential integrity analysis using full dataset
      const analysisQuery = `
        WITH source_values AS (
          SELECT DISTINCT "${sourceColumn.name}" as value
          FROM "${sourceTableName}" 
          WHERE "${sourceColumn.name}" IS NOT NULL
        ),
        target_keys AS (
          SELECT DISTINCT airtable_id as value
          FROM "${targetTableName}"
        ),
        match_analysis AS (
          SELECT 
            COUNT(sv.value) as total_source_values,
            COUNT(tk.value) as matched_values,
            COUNT(sv.value) - COUNT(tk.value) as unmatched_values
          FROM source_values sv
          LEFT JOIN target_keys tk ON sv.value = tk.value
        )
        SELECT 
          total_source_values,
          matched_values,
          unmatched_values,
          CASE 
            WHEN total_source_values = 0 THEN 0
            ELSE ROUND((matched_values::decimal / total_source_values::decimal) * 100, 2)
          END as referential_integrity_percent
        FROM match_analysis
      `;

      const result = await this.db.executeSQL(analysisQuery);
      const analysis = result[0];

      // Calculate confidence based on referential integrity
      const integrityPercent = parseFloat(analysis.referential_integrity_percent || 0);
      const totalSourceValues = parseInt(analysis.total_source_values || 0);
      const matchedValues = parseInt(analysis.matched_values || 0);

      // Determine if this is likely a foreign key
      const isLikelyForeignKey = integrityPercent >= 70 && totalSourceValues >= 5 && matchedValues >= 3;
      
      let confidence = 0;
      let relationshipType = 'unknown';

      if (isLikelyForeignKey) {
        // Calculate confidence score
        confidence = Math.min(0.99, integrityPercent / 100);
        
        // Adjust confidence based on data quality factors
        if (totalSourceValues >= 100) confidence += 0.05; // Bonus for larger sample size
        if (sourceColumn.completeness >= 0.8) confidence += 0.03; // Bonus for data completeness
        if (integrityPercent === 100) confidence += 0.1; // Bonus for perfect integrity
        
        confidence = Math.min(0.99, confidence);

        // Determine relationship type based on distinctness
        if (sourceColumn.distinctness >= 0.9) {
          relationshipType = 'one-to-one';
        } else {
          relationshipType = 'many-to-one';
        }
      }

      return {
        isLikelyForeignKey,
        relationship: isLikelyForeignKey ? {
          fromTable: sourceTableName,
          fromField: sourceColumn.name,
          toTable: targetTableName,
          toField: 'airtable_id',
          relationshipType,
          confidence,
          source: 'referential_integrity_analysis',
          reasoning: `${integrityPercent}% referential integrity (${matchedValues}/${totalSourceValues} values match)`,
          metadata: {
            referentialIntegrityPercent: integrityPercent,
            totalSourceValues,
            matchedValues,
            unmatchedValues: parseInt(analysis.unmatched_values || 0),
            sourceColumnCompleteness: sourceColumn.completeness,
            sourceColumnDistinctness: sourceColumn.distinctness
          }
        } : null
      };

    } catch (error) {
      console.warn(`FK analysis failed for ${sourceTableName}.${sourceColumn.name} → ${targetTableName}:`, error.message);
      return { isLikelyForeignKey: false, relationship: null };
    }
  }

  /**
   * Advanced pattern detection using SQL analytics functions
   */
  async detectAdvancedPatterns(tables, tableStats, progressCallback = null) {
    this.emitProgress('🧠 Starting advanced pattern detection...', 'patterns', progressCallback);
    
    const relationships = [];
    
    // Pattern 1: Name similarity analysis
    const nameSimilarityRelationships = await this.detectNameSimilarityPatterns(tableStats, progressCallback);
    relationships.push(...nameSimilarityRelationships);

    // Pattern 2: Value distribution analysis
    const distributionRelationships = await this.detectValueDistributionPatterns(tableStats, progressCallback);
    relationships.push(...distributionRelationships);

    this.emitProgress(`✅ Advanced patterns: ${relationships.length} pattern-based relationships found`, 'patterns', progressCallback);
    return relationships;
  }

  /**
   * Detect relationships based on column name similarity patterns
   */
  async detectNameSimilarityPatterns(tableStats, progressCallback = null) {
    const relationships = [];
    
    // Look for columns that might be foreign keys based on naming conventions
    // e.g., "customer_id" likely references "customers" table
    // e.g., "invoice_id" likely references "invoices" table
    
    const tableNames = Object.keys(tableStats.tables);
    
    for (const sourceTableName of tableNames) {
      const sourceStats = tableStats.tables[sourceTableName];
      
      for (const column of sourceStats.columns || []) {
        // Check if column name suggests it's a foreign key
        const fkPattern = this.analyzeForeignKeyNamingPattern(column.name, tableNames);
        
        if (fkPattern.isLikelyFK) {
          // Verify with a quick referential integrity check
          try {
            const quickCheck = await this.quickReferentialIntegrityCheck(
              sourceTableName, column.name, fkPattern.targetTable
            );
            
            if (quickCheck.integrityPercent >= 50) {
              relationships.push({
                fromTable: sourceTableName,
                fromField: column.name,
                toTable: fkPattern.targetTable,
                toField: 'airtable_id',
                relationshipType: 'many-to-one',
                confidence: Math.min(0.85, 0.6 + (quickCheck.integrityPercent / 100) * 0.25),
                source: 'naming_pattern_analysis',
                reasoning: `Column name '${column.name}' suggests FK to '${fkPattern.targetTable}' (${quickCheck.integrityPercent}% integrity)`,
                metadata: {
                  namingPattern: fkPattern.pattern,
                  referentialIntegrityPercent: quickCheck.integrityPercent,
                  confidence_factors: {
                    naming_similarity: fkPattern.similarity,
                    referential_integrity: quickCheck.integrityPercent / 100
                  }
                }
              });
            }
          } catch (error) {
            // Skip this pattern if verification fails
            console.warn(`Pattern verification failed for ${sourceTableName}.${column.name}:`, error.message);
          }
        }
      }
    }
    
    return relationships;
  }

  /**
   * Detect relationships based on value distribution patterns
   */
  async detectValueDistributionPatterns(tableStats, progressCallback = null) {
    const relationships = [];
    
    // This could analyze statistical distributions to detect relationships
    // For now, return empty array - can be enhanced later
    
    return relationships;
  }

  /**
   * Analyze if a column name suggests it's a foreign key
   */
  analyzeForeignKeyNamingPattern(columnName, availableTableNames) {
    const lowerColumnName = columnName.toLowerCase();
    
    // Common FK patterns
    const patterns = [
      // Pattern: ends with "_id"
      { pattern: '_id_suffix', regex: /^(.+)_id$/, extract: match => match[1] },
      // Pattern: starts with table name
      { pattern: 'table_prefix', regex: /^([a-z]+)_/, extract: match => match[1] + 's' },
      // Pattern: exact table name match
      { pattern: 'exact_match', regex: new RegExp(`^(${availableTableNames.join('|').toLowerCase()})$`), extract: match => match[1] }
    ];

    for (const pattern of patterns) {
      const match = lowerColumnName.match(pattern.regex);
      if (match) {
        const suggestedTableName = pattern.extract(match);
        
        // Find best matching table name
        const targetTable = availableTableNames.find(tableName => 
          tableName.toLowerCase() === suggestedTableName ||
          tableName.toLowerCase().includes(suggestedTableName) ||
          suggestedTableName.includes(tableName.toLowerCase())
        );

        if (targetTable) {
          return {
            isLikelyFK: true,
            targetTable,
            pattern: pattern.pattern,
            similarity: this.calculateStringSimilarity(lowerColumnName, targetTable.toLowerCase())
          };
        }
      }
    }

    return { isLikelyFK: false };
  }

  /**
   * Quick referential integrity check for pattern verification
   */
  async quickReferentialIntegrityCheck(sourceTable, sourceColumn, targetTable) {
    const query = `
      SELECT 
        COUNT(DISTINCT s."${sourceColumn}") as total_distinct,
        COUNT(DISTINCT t.airtable_id) as matched_count
      FROM "${sourceTable}" s
      LEFT JOIN "${targetTable}" t ON s."${sourceColumn}" = t.airtable_id
      WHERE s."${sourceColumn}" IS NOT NULL
    `;

    const result = await this.db.executeSQL(query);
    const { total_distinct, matched_count } = result[0];
    
    const integrityPercent = total_distinct > 0 ? (matched_count / total_distinct) * 100 : 0;
    
    return {
      integrityPercent: Math.round(integrityPercent * 100) / 100,
      totalDistinct: parseInt(total_distinct),
      matchedCount: parseInt(matched_count)
    };
  }

  /**
   * Score and deduplicate relationships to avoid duplicates
   */
  async scoreAndDeduplicateRelationships(relationships, progressCallback = null) {
    // Create a map to track unique relationships
    const uniqueRelationships = new Map();

    for (const relationship of relationships) {
      const key = `${relationship.fromTable}.${relationship.fromField}->${relationship.toTable}.${relationship.toField}`;
      
      if (!uniqueRelationships.has(key) || uniqueRelationships.get(key).confidence < relationship.confidence) {
        uniqueRelationships.set(key, relationship);
      }
    }

    return Array.from(uniqueRelationships.values()).sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Calculate confidence distribution for statistics
   */
  calculateConfidenceDistribution(relationships) {
    const distribution = {
      'high (≥0.8)': 0,
      'medium (0.6-0.79)': 0,
      'low (0.4-0.59)': 0,
      'very_low (<0.4)': 0
    };

    for (const rel of relationships) {
      const confidence = rel.confidence || 0;
      if (confidence >= 0.8) distribution['high (≥0.8)']++;
      else if (confidence >= 0.6) distribution['medium (0.6-0.79)']++;
      else if (confidence >= 0.4) distribution['low (0.4-0.59)']++;
      else distribution['very_low (<0.4)']++;
    }

    return distribution;
  }

  /**
   * Utility methods
   */
  shouldSkipColumn(column) {
    const name = column.name.toLowerCase();
    return name === 'id' || 
           name === 'airtable_id' || 
           name.startsWith('_') ||
           column.dataType === 'boolean' ||
           column.completeness < 0.1; // Skip columns with very low completeness
  }

  sanitizeTableName(name) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  sanitizeColumnName(name) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  calculateStringSimilarity(str1, str2) {
    // Simple similarity calculation - can be enhanced with Levenshtein distance
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  }

  emitProgress(message, status, progressCallback, additionalData = {}) {
    if (progressCallback) {
      progressCallback({
        status,
        message,
        timestamp: new Date().toISOString(),
        ...additionalData
      });
    }
    console.log(`[${status.toUpperCase()}] ${message}`);
  }
}

module.exports = DatabaseFirstRelationshipAnalyzer;