/**
 * Hybrid Relationship Analyzer
 * 
 * This service combines schema-based relationship detection with sample data analysis
 * to provide more accurate confidence scoring. It can work with both:
 * 1. Schema-only analysis (medium confidence)
 * 2. Schema + sample data analysis (high confidence)
 */

const AirtableService = require('./airtable');

class HybridRelationshipAnalyzer {
  constructor(databaseService) {
    this.db = databaseService;
    this.airtableService = new AirtableService();
    this.CONFIDENCE_THRESHOLD = 0.70;
    this.SAMPLE_SIZE = 50; // Sample records per table for analysis (performance optimization)
  }

  /**
   * Emits real-time progress updates using existing progress callback system
   */
  emitProgress(message, status = 'analyzing', progressCallback = null) {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    
    console.log(logMessage); // Still log to backend console
    
    if (progressCallback) {
      progressCallback({
        status: status,
        message: logMessage,
        timestamp: timestamp,
        phase: 'analysis'
      });
    }
  }

  /**
   * Analyzes relationships using both schema metadata and sample data.
   * Provides higher confidence scores than schema-only analysis.
   * 
   * @param {Object} settings - Airtable connection settings
   * @returns {Promise<Object>} Comprehensive relationship analysis
   */
  async analyzeRelationshipsHybrid(settings, progressCallback = null) {
    this.emitProgress('🚀 Starting hybrid relationship analysis...', 'analyzing', progressCallback);
    this.emitProgress('🔧 Configuration: Using sample size of 50 records per table for performance optimization', 'analyzing', progressCallback);
    this.emitProgress('📡 Data source: Direct from Airtable API (no local database storage)', 'analyzing', progressCallback);
    
    try {
      // Step 1: Connect to Airtable
      this.emitProgress('🔗 Connecting to Airtable API...', 'connecting', progressCallback);
      this.airtableService.connect(settings.airtableApiKey, settings.airtableBaseId);
      this.emitProgress('✅ Connected to Airtable base: ' + settings.airtableBaseId, 'connected', progressCallback);
      
      // Step 2: Get schema information
      this.emitProgress('🔍 Starting schema analysis...', 'schema-analysis', progressCallback);
      const schemaAnalysis = await this.analyzeSchemaRelationships(progressCallback);
      this.emitProgress(`✅ Schema analysis complete: ${schemaAnalysis.tables.length} tables, ${schemaAnalysis.relationships.length} relationships found`, 'schema-complete', progressCallback);
      
      // Step 3: Get sample data for statistical analysis
      this.emitProgress('📊 Starting sample data collection...', 'data-collection', progressCallback);
      this.emitProgress('💡 Why 50 records? Balance between accuracy and performance - larger samples take exponentially longer', 'data-collection', progressCallback);
      const sampleData = await this.getSampleDataFromTables(schemaAnalysis.tables, progressCallback);
      this.emitProgress(`✅ Sample data collection complete: ${sampleData.length} tables with data`, 'data-complete', progressCallback);
      
      // Step 4: Perform statistical analysis on sample data
      this.emitProgress('🧮 Starting statistical pattern analysis...', 'pattern-analysis', progressCallback);
      const dataPatternAnalysis = await this.analyzeDataPatterns(sampleData, progressCallback);
      this.emitProgress(`✅ Pattern analysis complete: ${dataPatternAnalysis.relationships?.length || 0} data patterns detected`, 'pattern-complete', progressCallback);
      
      // Step 5: Combine schema and data analysis for final confidence scores
      this.emitProgress('🔄 Combining schema and data analysis...', 'combining', progressCallback);
      const hybridAnalysis = await this.combineAnalysisResults(schemaAnalysis, dataPatternAnalysis, progressCallback);
      
      this.emitProgress(`🎉 Hybrid analysis complete!`, 'completed', progressCallback);
      this.emitProgress(`📈 Final results: ${hybridAnalysis.relationships.length} total relationships`, 'completed', progressCallback);
      this.emitProgress(`   • High confidence (≥70%): ${hybridAnalysis.analysis.highConfidenceCount}`, 'completed', progressCallback);
      this.emitProgress(`   • Data enhanced: ${hybridAnalysis.analysis.dataEnhancedCount}`, 'completed', progressCallback);
      this.emitProgress(`   • Schema only: ${hybridAnalysis.analysis.schemaBasedCount - hybridAnalysis.analysis.dataEnhancedCount}`, 'completed', progressCallback);
      
      return hybridAnalysis;
      
    } catch (error) {
      console.error('Hybrid relationship analysis failed:', error.message);
      throw new Error(`Hybrid analysis error: ${error.message}`);
    }
  }

  /**
   * Performs schema-based relationship analysis with improved table resolution.
   * This provides baseline relationship detection with proper target table mapping.
   */
  async analyzeSchemaRelationships(progressCallback = null) {
    this.emitProgress('📋 Discovering tables using Airtable Metadata API...', 'schema-discovery', progressCallback);
    
    // Step 1: Discover all tables with full metadata (id, name, recordCount)
    const tables = await this.airtableService.discoverTablesWithCounts();
    this.emitProgress(`📊 Discovered ${tables.length} tables in Airtable base`, 'schema-discovery', progressCallback);
    
    // Show table details
    for (const table of tables) {
      this.emitProgress(`   • ${table.name}: ${table.recordCount} records (ID: ${table.id.substring(0,8)}...)`, 'schema-discovery', progressCallback);
    }
    
    // Step 2: Create lookup map for table ID to table object
    this.emitProgress('🗺️  Building table lookup maps for relationship resolution...', 'schema-mapping', progressCallback);
    const tableIdMap = new Map();
    const tableNameMap = new Map();
    
    for (const table of tables) {
      tableIdMap.set(table.id, table);
      tableNameMap.set(table.name, table);
    }
    
    this.emitProgress(`✅ Built lookup maps for ${tableIdMap.size} tables`, 'schema-mapping', progressCallback);
    
    const relationships = [];
    
    // Step 3: Analyze each table's schema for linked record fields
    for (const table of tables) {
      try {
        console.log(`Getting schema for table: ${table.name} (ID: ${table.id})`);
        const tableSchema = await this.airtableService.getTableSchema(table.name);
        
        if (tableSchema && tableSchema.fields) {
          console.log(`Table ${table.name} has ${tableSchema.fields.length} fields`);
          const linkedRecordFields = tableSchema.fields.filter(f => f.type === 'multipleRecordLinks');
          console.log(`Found ${linkedRecordFields.length} linked record fields in ${table.name}`);
          
          for (const field of tableSchema.fields) {
            console.log(`  Field: ${field.name}, Type: ${field.type}, Options:`, field.options);
            if (field.type === 'multipleRecordLinks') {
              console.log(`  ✓ Found linked record field: ${table.name}.${field.name} -> ${field.options?.linkedTableId}`);
              
              // Find the target table by matching table IDs
              const targetTable = tableIdMap.get(field.options?.linkedTableId);
              
              if (targetTable) {
                console.log(`  ✓ Target table found: ${targetTable.name}`);
                
                // Calculate schema-based confidence (starts at 65-80% for linked records)
                let baseConfidence = 0.65; // 65% base confidence for linked record fields
                
                // Boost confidence based on schema evidence
                if (field.options?.isReversed) {
                  baseConfidence += 0.10; // +10% for symmetric relationships
                }
                
                if (field.options?.inverseLinkFieldId) {
                  baseConfidence += 0.10; // +10% for explicit inverse field
                }
                
                // Cap at reasonable maximum for schema-only analysis
                const schemaConfidence = Math.min(baseConfidence, 0.80);
                
                const relationship = {
                  sourceTable: table.name,
                  sourceField: field.name,
                  targetTable: targetTable.name,
                  targetTableId: targetTable.id,
                  type: 'one-to-many', // Default assumption for linked records
                  confidence: schemaConfidence,
                  source: 'schema',
                  reason: `Linked record field detected in schema with ${(schemaConfidence * 100).toFixed(0)}% confidence`,
                  schemaEvidence: {
                    fieldType: field.type,
                    linkedTableId: field.options?.linkedTableId,
                    isSymmetric: field.options?.isReversed || false,
                    hasInverseField: !!field.options?.inverseLinkFieldId,
                    inverseFieldId: field.options?.inverseLinkFieldId
                  }
                };
                
                relationships.push(relationship);
              } else {
                console.log(`  ✗ Target table not found for ID: ${field.options?.linkedTableId}`);
                console.log(`    Available table IDs: ${Array.from(tableIdMap.keys()).slice(0, 5).join(', ')}...`);
              }
            }
          }
        }
      } catch (error) {
        console.error(`❌ Failed to get schema for table ${table.name}:`, error.message);
        console.error('Error details:', error);
        // Continue with other tables
      }
    }
    
    console.log(`Schema analysis found ${relationships.length} relationships`);
    
    return {
      tables,
      relationships,
      source: 'schema-analysis',
      tableIdMap,
      tableNameMap
    };
  }

  /**
   * Gets sample data from all tables for statistical analysis.
   * Limits to SAMPLE_SIZE records per table to avoid performance issues.
   */
  async getSampleDataFromTables(tables, progressCallback = null) {
    this.emitProgress(`📊 Starting sample data collection from ${tables.length} tables...`, 'data-collection', progressCallback);
    this.emitProgress('🔄 Method: Direct API calls to Airtable (no local storage)', 'data-collection', progressCallback);
    
    const sampleData = [];
    let processedTables = 0;
    
    for (const table of tables) {
      try {
        processedTables++;
        
        this.emitProgress(`📥 [${processedTables}/${tables.length}] Sampling ${table.name}...`, 'data-sampling', progressCallback);
        this.emitProgress(`   🎯 Target: ${this.SAMPLE_SIZE} records (total: ${table.recordCount})`, 'data-sampling', progressCallback);
        
        // Use the existing AirtableService progress callback system
        const startTime = Date.now();
        const records = await this.airtableService.getTableRecords(table.name, (progressData) => {
          // Forward Airtable progress to our analysis progress
          if (progressCallback) {
            progressCallback({
              status: 'fetching-data',
              message: `[${new Date().toLocaleTimeString()}] 📄 Fetching ${table.name}: ${progressData.recordsProcessed} records...`,
              table: table.name,
              recordsProcessed: progressData.recordsProcessed
            });
          }
        }, {
          maxRecords: this.SAMPLE_SIZE
        });
        const duration = Date.now() - startTime;
        
        if (records && records.length > 0) {
          const samplingRatio = ((records.length / table.recordCount) * 100).toFixed(1);
          
          sampleData.push({
            name: table.name,
            records: records,
            sampleSize: records.length,
            totalEstimate: table.recordCount || records.length
          });
          
          this.emitProgress(`   ✅ Sampled ${records.length}/${table.recordCount} records (${samplingRatio}%) in ${duration}ms`, 'data-sampling', progressCallback);
        } else {
          this.emitProgress(`   ⚠️  No records found in table ${table.name}`, 'data-sampling', progressCallback);
        }
        
      } catch (error) {
        this.emitProgress(`   ❌ Failed to sample ${table.name}: ${error.message}`, 'data-error', progressCallback);
        // Continue with other tables
      }
    }
    
    const totalRecordsSampled = sampleData.reduce((sum, table) => sum + table.sampleSize, 0);
    this.emitProgress(`✅ Sample collection complete: ${sampleData.length} tables, ${totalRecordsSampled} total records`, 'data-complete', progressCallback);
    return sampleData;
  }

  /**
   * Performs statistical analysis on sample data.
   * Uses the existing DataPatternAnalyzer logic but with sample data.
   */
  async analyzeDataPatterns(sampleData, progressCallback = null) {
    if (!sampleData || sampleData.length === 0) {
      this.emitProgress('⚠️ No sample data available for pattern analysis', 'pattern-error', progressCallback);
      return { relationships: [], confidence: 'low', source: 'no-data' };
    }
    
    this.emitProgress('🧠 Analyzing data patterns from sample data...', 'pattern-start', progressCallback);
    
    const DataPatternAnalyzer = require('./dataPatternAnalyzer');
    const analyzer = new DataPatternAnalyzer(this.db);
    
    try {
      // Pass progress callback to the DataPatternAnalyzer if it supports it
      const analysis = await analyzer.analyzeDataPatterns(sampleData, progressCallback);
      analysis.source = 'data-patterns';
      
      this.emitProgress(`✅ Data pattern analysis complete: ${analysis.relationships?.length || 0} patterns found`, 'pattern-complete', progressCallback);
      return analysis;
    } catch (error) {
      this.emitProgress(`⚠️ Data pattern analysis failed, falling back to schema-only: ${error.message}`, 'pattern-error', progressCallback);
      return { relationships: [], confidence: 'low', source: 'data-analysis-failed' };
    }
  }

  /**
   * Combines schema analysis with data pattern analysis for enhanced confidence.
   * Schema provides relationship discovery, data patterns provide confidence scoring.
   */
  async combineAnalysisResults(schemaAnalysis, dataPatternAnalysis, progressCallback = null) {
    this.emitProgress('🔀 Combining schema and data pattern analysis results...', 'combine-start', progressCallback);
    
    const combinedRelationships = [];
    const recommendations = {
      highConfidence: [],
      lowConfidence: [],
      autoSuggestions: [],
      manualReview: []
    };
    
    // Start with schema relationships as baseline
    this.emitProgress(`🔗 Processing ${schemaAnalysis.relationships.length} schema relationships...`, 'combine-processing', progressCallback);
    
    let processedRelationships = 0;
    for (const schemaRel of schemaAnalysis.relationships) {
      processedRelationships++;
      
      if (processedRelationships % 10 === 0) {
        this.emitProgress(`   📊 Processing relationship ${processedRelationships}/${schemaAnalysis.relationships.length}`, 'combine-processing', progressCallback);
      }
      
      let enhancedRelationship = { ...schemaRel };
      
      // Try to find matching data pattern analysis
      const dataPattern = dataPatternAnalysis.relationships?.find(dr => 
        dr.sourceTable === schemaRel.sourceTable && 
        dr.sourceField === schemaRel.sourceField &&
        dr.targetTable === schemaRel.targetTable
      );
      
      if (dataPattern) {
        // Enhance with data pattern analysis
        enhancedRelationship = {
          ...schemaRel,
          ...dataPattern,
          confidence: this.calculateHybridConfidence(schemaRel, dataPattern),
          hybridAnalysis: true,
          schemaEvidence: schemaRel.schemaEvidence,
          dataEvidence: dataPattern.dataEvidence,
          reasoning: this.generateHybridReasoning(schemaRel, dataPattern)
        };
        
        this.emitProgress(`   ✅ Enhanced ${schemaRel.sourceTable}.${schemaRel.sourceField} → ${schemaRel.targetTable} with data patterns (${(enhancedRelationship.confidence*100).toFixed(1)}%)`, 'combine-enhanced', progressCallback);
      } else {
        // Schema-only relationship
        enhancedRelationship.confidence = this.calculateSchemaOnlyConfidence(schemaRel);
        enhancedRelationship.hybridAnalysis = false;
        enhancedRelationship.reasoning = `Schema-based relationship detection. ${this.generateSchemaReasoning(schemaRel)}`;
        
        this.emitProgress(`   📋 Schema-only ${schemaRel.sourceTable}.${schemaRel.sourceField} → ${schemaRel.targetTable} (${(enhancedRelationship.confidence*100).toFixed(1)}%)`, 'combine-schema-only', progressCallback);
      }
      
      combinedRelationships.push(enhancedRelationship);
      
      // Categorize by confidence
      if (enhancedRelationship.confidence >= this.CONFIDENCE_THRESHOLD) {
        recommendations.highConfidence.push(enhancedRelationship);
        recommendations.autoSuggestions.push(enhancedRelationship);
      } else {
        recommendations.lowConfidence.push(enhancedRelationship);
        recommendations.manualReview.push(enhancedRelationship);
      }
    }
    
    return {
      relationships: combinedRelationships,
      recommendations,
      analysis: {
        schemaBasedCount: schemaAnalysis.relationships.length,
        dataEnhancedCount: combinedRelationships.filter(r => r.hybridAnalysis).length,
        highConfidenceCount: recommendations.highConfidence.length,
        lowConfidenceCount: recommendations.lowConfidence.length
      },
      sources: ['schema-analysis', dataPatternAnalysis.source]
    };
  }

  /**
   * Calculates hybrid confidence score combining schema and data evidence.
   */
  calculateHybridConfidence(schemaRel, dataPattern) {
    let confidence = 0;
    
    // Base confidence from schema (30%)
    const schemaConfidence = this.calculateSchemaOnlyConfidence(schemaRel);
    confidence += schemaConfidence * 0.3;
    
    // Data pattern confidence (70%)
    if (dataPattern.confidence) {
      confidence += dataPattern.confidence * 0.7;
    }
    
    // Boost for consistent schema + data evidence
    if (this.schemaDataConsistency(schemaRel, dataPattern)) {
      confidence += 0.1; // 10% boost for consistency
    }
    
    return Math.min(confidence, 1.0); // Cap at 100%
  }

  /**
   * Calculates confidence for schema-only relationships.
   * This should provide the confidence that was already calculated in analyzeSchemaRelationships.
   */
  calculateSchemaOnlyConfidence(schemaRel) {
    // If confidence was already calculated in schema analysis, use that
    if (schemaRel.confidence && schemaRel.confidence > 0) {
      return schemaRel.confidence;
    }
    
    // Fallback calculation for legacy relationships
    let confidence = 0.65; // Base 65% for linked record fields
    
    // Boost for bidirectional relationships
    if (schemaRel.schemaEvidence?.hasInverseField) {
      confidence += 0.10;
    }
    
    // Boost for explicit symmetric relationships
    if (schemaRel.schemaEvidence?.isSymmetric) {
      confidence += 0.05;
    }
    
    return Math.min(confidence, 0.80); // Cap schema-only at 80%
  }

  /**
   * Checks consistency between schema and data evidence.
   */
  schemaDataConsistency(schemaRel, dataPattern) {
    // Check if relationship types are compatible
    const schemaType = schemaRel.type;
    const dataType = dataPattern.type;
    
    // Compatible type mappings
    const compatibleTypes = {
      'many-to-many': ['many-to-many', 'one-to-many'],
      'one-to-many': ['one-to-many', 'many-to-many'],
      'one-to-one': ['one-to-one', 'one-to-many']
    };
    
    return compatibleTypes[schemaType]?.includes(dataType) || false;
  }

  /**
   * Generates reasoning text for hybrid analysis.
   */
  generateHybridReasoning(schemaRel, dataPattern) {
    let reasoning = `Hybrid analysis combining schema metadata with actual data patterns. `;
    
    // Schema evidence
    if (schemaRel.schemaEvidence?.hasInverseField) {
      reasoning += `Schema shows bidirectional relationship. `;
    }
    
    // Data evidence
    if (dataPattern.dataEvidence) {
      const stats = dataPattern.dataEvidence;
      reasoning += `Data analysis shows ${(stats.multipleReferencePercentage * 100).toFixed(0)}% of records have multiple references, `;
      reasoning += `${(stats.singleReferencePercentage * 100).toFixed(0)}% have single references. `;
    }
    
    // Consistency
    if (this.schemaDataConsistency(schemaRel, dataPattern)) {
      reasoning += `Schema and data evidence are consistent, increasing confidence.`;
    } else {
      reasoning += `Some inconsistency between schema and data patterns detected.`;
    }
    
    return reasoning;
  }

  /**
   * Generates reasoning for schema-only relationships.
   */
  generateSchemaReasoning(schemaRel) {
    let reasoning = `Linked record field detected in Airtable schema. `;
    
    if (schemaRel.schemaEvidence?.hasInverseField) {
      reasoning += `Bidirectional relationship with inverse field. `;
    }
    
    if (schemaRel.schemaEvidence?.isSymmetric) {
      reasoning += `Marked as symmetric relationship. `;
    }
    
    reasoning += `Consider reviewing with actual data for higher confidence.`;
    
    return reasoning;
  }
}

module.exports = HybridRelationshipAnalyzer;