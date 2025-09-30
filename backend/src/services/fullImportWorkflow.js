/**
 * Full Import Workflow Service
 * 
 * Comprehensive service that handles the complete Airtable-to-PostgreSQL import workflow:
 * 1. Schema Discovery - Analyze Airtable structure
 * 2. Database Creation - Create PostgreSQL tables with proper naming
 * 3. Data Import - Import ALL records (not just samples)
 * 4. Relationship Analysis - Analyze imported data for relationships
 * 5. Schema Enhancement - Apply foreign keys and junction tables
 * 
 * This replaces the previous sample-based analysis with a full import approach.
 */

const AirtableService = require('./airtable');
const DatabaseService = require('./database');
const ImportService = require('./import');
const EnhancedImportService = require('./enhancedImportService');
const PostgreSQLRelationshipAnalyzer = require('./postgreSQLRelationshipAnalyzer');

class FullImportWorkflowService {
  constructor(appDb) {
    this.appDb = appDb; // Main application database (Prisma, metadata, users, settings)
    this.importDb = null; // Import target database (where Airtable data goes)
    this.airtableService = new AirtableService();
    this.importService = new ImportService();
  }

  /**
   * Execute the complete full import workflow.
   * This is the main orchestrator function that coordinates all workflow stages.
   * 
   * @param {Object} settings - User settings containing Airtable credentials
   * @param {Function} progressCallback - Progress reporting callback
   * @returns {Promise<Object>} Complete workflow results
   */
  async executeFullWorkflow(settings, progressCallback = null) {
    this.emitProgress('🚀 Starting full import workflow...', 'confirming', progressCallback);
    this.emitProgress('📋 Workflow: Schema Discovery → Database Creation → Full Import → Relationship Analysis → Schema Enhancement', 'confirming', progressCallback);
    

    
    try {
      // Stage 1: Connect to Airtable and discover schema
      this.emitProgress('🔗 Connecting to Airtable API...', 'connecting', progressCallback);
      this.airtableService.connect(settings.airtableApiKey, settings.airtableBaseId);
      
      // Connect to import target database (where Airtable data will be stored)
      this.emitProgress('🔗 Connecting to import target database...', 'connecting', progressCallback);
      console.log('🔍 DEBUG: About to connect importDb with:', {
        databaseUrl: settings.databaseUrl,
        databaseUrlType: typeof settings.databaseUrl,
        airtableBaseId: settings.airtableBaseId
      });
      const ImportDatabaseService = require('./importDatabase');
      this.importDb = new ImportDatabaseService();
      await this.importDb.connect(settings.databaseUrl, settings.airtableBaseId);
      
      // Note: Using externalDb directly for this workflow, no need for separate import service connection
      
      this.emitProgress('🔍 Discovering Airtable schema...', 'schema-discovery', progressCallback);
      const schemaDiscovery = await this.discoverAirtableSchema(progressCallback);
      
      // Stage 2: Create PostgreSQL database structure
      this.emitProgress('🏗️ Creating PostgreSQL database structure...', 'creating-tables', progressCallback);
      const databaseCreation = await this.createDatabaseStructure(schemaDiscovery, progressCallback);
      
      // Stage 3: Import all data from Airtable
      this.emitProgress('📥 Starting full data import...', 'import-starting', progressCallback);
      const importResults = await this.importAllData(schemaDiscovery.tables, progressCallback);
      
      // Stage 4: Analyze relationships from imported data
      this.emitProgress('🧠 Analyzing relationships from imported data...', 'analyzing-relationships', progressCallback);
      const relationshipAnalysis = await this.analyzeRelationshipsFromDB(schemaDiscovery.tables, progressCallback);
      
      // Stage 5: Apply relationship schema enhancements
      this.emitProgress('⚡ Applying schema enhancements...', 'creating-foreign-keys', progressCallback);
      const schemaEnhancements = await this.applySchemaEnhancements(relationshipAnalysis, progressCallback);
      
      // Final results compilation
      this.emitProgress('✅ Full import workflow completed successfully!', 'completed', progressCallback);
      
      const workflowResults = {
        success: true,
        tablesCreated: databaseCreation.tablesCreated,
        enumsCreated: databaseCreation.enumsCreated,
        recordsImported: importResults.totalRecords,
        relationships: relationshipAnalysis.relationships,
        analysis: relationshipAnalysis.analysis,
        recommendations: relationshipAnalysis.recommendations,
        schemaEnhancements,
        source: 'full-import-workflow',
        workflow: {
          schemaDiscovery,
          databaseCreation,
          importResults,
          relationshipAnalysis,
          schemaEnhancements
        }
      };
      
      this.emitProgress(`📊 Final Results: ${workflowResults.tablesCreated} tables, ${workflowResults.recordsImported} records, ${workflowResults.relationships.length} relationships`, 'completed', progressCallback);
      
      return workflowResults;
      
    } catch (error) {
      console.error('Full import workflow failed:', error.message);
      this.emitProgress(`❌ Workflow failed: ${error.message}`, 'error', progressCallback);
      throw new Error(`Full import workflow error: ${error.message}`);
    }
  }

  /**
   * Stage 1: Discover Airtable schema and prepare table definitions.
   * Gets complete table and field information for database creation.
   */
  async discoverAirtableSchema(progressCallback = null) {
    this.emitProgress('📋 Fetching table list from Airtable...', 'schema-analysis', progressCallback);
    
    const tables = await this.airtableService.discoverTablesWithCounts();
    this.emitProgress(`✅ Found ${tables.length} tables in Airtable base`, 'schema-analysis', progressCallback);
    
    const schemaInfo = {
      tables: [],
      totalTables: tables.length,
      fieldTypes: new Set()
    };
    
    // Get detailed schema for each table
    let processedTables = 0;
    for (const table of tables) {
      processedTables++;
      this.emitProgress(`🔍 [${processedTables}/${tables.length}] Analyzing schema for table: ${table.name}`, 'schema-analysis', progressCallback);
      
      try {
        const tableSchema = await this.airtableService.getTableSchema(table.name);
        
        // Analyze field types for ENUM creation decisions
        const tableInfo = {
          ...table,
          schema: tableSchema,
          fields: tableSchema.fields || [],
          enumCandidates: this.identifyEnumCandidates(tableSchema.fields || [])
        };
        
        schemaInfo.tables.push(tableInfo);
        
        // Collect field types for statistics
        (tableSchema.fields || []).forEach(field => {
          schemaInfo.fieldTypes.add(field.type);
        });
        
        this.emitProgress(`   ✅ ${tableInfo.fields.length} fields, ${tableInfo.enumCandidates.length} ENUM candidates`, 'schema-analysis', progressCallback);
        
      } catch (error) {
        this.emitProgress(`   ⚠️ Failed to get schema for ${table.name}: ${error.message}`, 'schema-analysis', progressCallback);
        // Continue with basic table info
        schemaInfo.tables.push(table);
      }
    }
    
    this.emitProgress(`✅ Schema discovery complete: ${schemaInfo.tables.length} tables analyzed`, 'schema-complete', progressCallback);
    return schemaInfo;
  }

  /**
   * Stage 2: Create PostgreSQL database structure.
   * Creates tables with snake_case naming and ENUMs for appropriate fields.
   */
  async createDatabaseStructure(schemaDiscovery, progressCallback = null) {
    this.emitProgress('🏗️ Creating PostgreSQL tables and ENUMs...', 'creating-tables', progressCallback);
    
    const results = {
      tablesCreated: 0,
      enumsCreated: 0,
      createdTables: [],
      createdEnums: []
    };
    
    // First pass: Create ENUMs for single select fields
    this.emitProgress('🎨 Creating ENUMs for single select fields...', 'creating-enums', progressCallback);
    for (const table of schemaDiscovery.tables) {
      if (table.enumCandidates && table.enumCandidates.length > 0) {
        for (const enumCandidate of table.enumCandidates) {
          try {
            await this.createPostgreSQLEnum(enumCandidate, progressCallback);
            results.enumsCreated++;
            results.createdEnums.push(enumCandidate);
          } catch (error) {
            this.emitProgress(`   ⚠️ Failed to create ENUM ${enumCandidate.name}: ${error.message}`, 'creating-enums', progressCallback);
          }
        }
      }
    }
    
    // Second pass: Create tables
    let processedTables = 0;
    for (const table of schemaDiscovery.tables) {
      processedTables++;
      this.emitProgress(`🏗️ [${processedTables}/${schemaDiscovery.tables.length}] Creating table: ${table.name}`, 'creating-tables', progressCallback);
      
      try {
        const tableCreationResult = await this.createPostgreSQLTable(table, progressCallback);
        results.tablesCreated++;
        results.createdTables.push(tableCreationResult);
        
        this.emitProgress(`   ✅ Table created with ${tableCreationResult.columns} columns`, 'creating-tables', progressCallback);
        
      } catch (error) {
        this.emitProgress(`   ❌ Failed to create table ${table.name}: ${error.message}`, 'creating-tables', progressCallback);
        throw error; // Stop workflow on table creation failure
      }
    }
    
    this.emitProgress(`✅ Database structure created: ${results.tablesCreated} tables, ${results.enumsCreated} ENUMs`, 'database-ready', progressCallback);
    return results;
  }

  /**
   * Stage 3: Import all data from Airtable to PostgreSQL with batch processing.
   * Uses enhanced import service for high-performance batch imports with TQDM-style progress.
   */
  async importAllData(tables, progressCallback = null) {
    this.emitProgress('📥 Starting full data import for all tables with batch processing...', 'import-starting', progressCallback);
    
    const importResults = {
      totalRecords: 0,
      tableResults: [],
      importedTables: 0,
      totalBatches: 0,
      avgRecordsPerSecond: 0
    };
    
    // Generate a session ID for the import process
    const importSessionId = `batch-import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Initialize enhanced import service
    const enhancedImportService = new EnhancedImportService();
    
    try {
      // Connect enhanced import service to import target database
      await enhancedImportService.connect(
        this.airtableService.apiKey,
        this.airtableService.baseId,
        this.importDb
      );
      
      let processedTables = 0;
      const startTime = Date.now();
      
      for (const table of tables) {
        processedTables++;
        const tableProgressPercent = (processedTables / tables.length) * 100;
        
        this.emitProgress(`📊 [${processedTables}/${tables.length}] Starting batch import: ${table.name}`, 'importing-data', progressCallback, {
          importProgress: tableProgressPercent,
          currentTable: table.name,
          completedTables: processedTables - 1,
          totalTables: tables.length
        });
        
        try {
          // Use enhanced batch import with TQDM-style progress
          const tableImportResult = await enhancedImportService.importTableWithBatches(
            table.name,
            importSessionId,
            (batchProgress) => {
              // Forward batch progress to main progress callback
              this.emitProgress(batchProgress.message, 'batch-progress', progressCallback, {
                ...batchProgress,
                tableIndex: processedTables,
                totalTables: tables.length,
                overallProgress: ((processedTables - 1) / tables.length * 100) + (batchProgress.progress || 0) / tables.length
              });
            },
            { overwrite: true, batchSize: 500 } // Configure batch size for optimal performance
          );
          
          importResults.totalRecords += (tableImportResult.recordsImported || 0);
          importResults.tableResults.push(tableImportResult);
          importResults.importedTables++;
          importResults.totalBatches += (tableImportResult.batches || 0);
          
          this.emitProgress(`   ✅ Batch import complete for ${table.name}: ${tableImportResult.recordsImported || 0} records in ${tableImportResult.batches || 0} batches (${tableImportResult.avgRecordsPerSecond || 0} rec/sec)`, 'importing-data', progressCallback);
          
        } catch (error) {
          this.emitProgress(`   ❌ Failed to import ${table.name}: ${error.message}`, 'importing-data', progressCallback);
          console.error(`Batch import failed for table ${table.name}:`, error);
          // Continue with other tables - don't fail entire workflow
        }
      }
      
      const totalDuration = Date.now() - startTime;
      importResults.avgRecordsPerSecond = Math.round((importResults.totalRecords / totalDuration) * 1000);
      
      this.emitProgress(`✅ Batch import complete: ${importResults.totalRecords} total records from ${importResults.importedTables} tables in ${importResults.totalBatches} batches (avg ${importResults.avgRecordsPerSecond} rec/sec)`, 'import-complete', progressCallback);
      
    } finally {
      // Always disconnect the enhanced import service
      await enhancedImportService.disconnect();
    }
    
    return importResults;
  }

  /**
   * Stage 4: Analyze relationships from imported PostgreSQL data.
   * Uses actual database data instead of Airtable samples.
   */
  async analyzeRelationshipsFromDB(tables, progressCallback = null) {
    this.emitProgress('🧠 Analyzing relationships from PostgreSQL data...', 'analyzing-relationships', progressCallback);
    
    // Use a modified version of the hybrid analyzer that works with PostgreSQL data
    const PostgreSQLRelationshipAnalyzer = require('./postgreSQLRelationshipAnalyzer');
    const analyzer = new PostgreSQLRelationshipAnalyzer(this.importDb);
    
    const analysisResults = await analyzer.analyzeRelationshipsFromDB(tables, progressCallback);
    
    this.emitProgress(`✅ Relationship analysis complete: ${analysisResults.relationships.length} relationships detected`, 'pattern-complete', progressCallback);
    return analysisResults;
  }

  /**
   * Stage 5: Apply schema enhancements based on relationship analysis.
   * Creates foreign keys, junction tables, and other relationship artifacts.
   */
  async applySchemaEnhancements(relationshipAnalysis, progressCallback = null) {
    this.emitProgress('⚡ Applying schema enhancements...', 'creating-foreign-keys', progressCallback);
    
    const enhancements = {
      foreignKeysCreated: 0,
      junctionTablesCreated: 0,
      constraintsAdded: 0,
      enhancements: []
    };
    
    // Apply foreign key constraints for high-confidence relationships
    const highConfidenceRelationships = relationshipAnalysis.relationships.filter(rel => rel.confidence >= 0.7);
    
    this.emitProgress(`🔗 Creating foreign keys for ${highConfidenceRelationships.length} high-confidence relationships...`, 'creating-foreign-keys', progressCallback);
    
    for (const relationship of highConfidenceRelationships) {
      try {
        if (relationship.type === 'many-to-many') {
          // Create junction table for many-to-many relationships
          const junctionResult = await this.createJunctionTable(relationship, progressCallback);
          enhancements.junctionTablesCreated++;
          enhancements.enhancements.push(junctionResult);
        } else {
          // Create foreign key constraint
          const fkResult = await this.createForeignKeyConstraint(relationship, progressCallback);
          enhancements.foreignKeysCreated++;
          enhancements.enhancements.push(fkResult);
        }
      } catch (error) {
        this.emitProgress(`   ⚠️ Failed to enhance ${relationship.sourceTable}.${relationship.sourceField}: ${error.message}`, 'creating-foreign-keys', progressCallback);
      }
    }
    
    this.emitProgress(`✅ Schema enhancements applied: ${enhancements.foreignKeysCreated} FKs, ${enhancements.junctionTablesCreated} junction tables`, 'schema-enhanced', progressCallback);
    return enhancements;
  }

  /**
   * Helper method to emit progress updates with consistent formatting.
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

  /**
   * Identify ENUM candidates from Airtable field definitions.
   * SingleSelect fields with ≤20 options become PostgreSQL ENUMs.
   */
  identifyEnumCandidates(fields) {
    return fields
      .filter(field => field.type === 'singleSelect' && field.options?.choices?.length <= 20)
      .map(field => ({
        name: `${field.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_enum`,
        choices: field.options.choices.map(choice => choice.name),
        originalField: field
      }));
  }

  /**
   * Create PostgreSQL ENUM type for single select fields.
   * Handles existing ENUMs gracefully to avoid conflicts.
   */
  async createPostgreSQLEnum(enumCandidate, progressCallback = null) {
    this.emitProgress(`   🎨 Creating ENUM: ${enumCandidate.name} with ${enumCandidate.choices.length} values`, 'creating-enums', progressCallback);
    
    try {
      // Check if ENUM already exists
      const checkEnumSQL = `
        SELECT 1 FROM pg_type 
        WHERE typname = $1 AND typtype = 'e'
      `;
      const enumExists = await this.importDb.executeSQL(checkEnumSQL, [enumCandidate.name]);
      
      if (enumExists.rows && enumExists.rows.length > 0) {
        this.emitProgress(`   ✅ ENUM ${enumCandidate.name} already exists, skipping creation`, 'creating-enums', progressCallback);
        return enumCandidate;
      }
      
      // Create new ENUM
      const enumValues = enumCandidate.choices.map(choice => `'${choice.replace(/'/g, "''")}'`).join(', ');
      const createEnumSQL = `CREATE TYPE ${enumCandidate.name} AS ENUM (${enumValues})`;
      
      await this.importDb.executeSQL(createEnumSQL);
      this.emitProgress(`   ✅ Created ENUM: ${enumCandidate.name}`, 'creating-enums', progressCallback);
      return enumCandidate;
      
    } catch (error) {
      // If ENUM creation fails, log warning but continue (might already exist from previous run)
      this.emitProgress(`   ⚠️ ENUM creation warning for ${enumCandidate.name}: ${error.message}`, 'creating-enums', progressCallback);
      console.warn(`ENUM creation warning for ${enumCandidate.name}:`, error.message);
      return enumCandidate;
    }
  }

  /**
   * Create PostgreSQL table based on Airtable schema.
   */
  async createPostgreSQLTable(table, progressCallback = null) {
    // Implementation details for table creation
    // This would use the existing database service methods
    // but with ENUM support and proper field type mapping
    
    const tableName = table.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    // Build column definitions with ENUM support
    const columnDefinitions = ['id SERIAL PRIMARY KEY'];
    
    if (table.fields) {
      for (const field of table.fields) {
        const columnName = field.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        let columnType = this.mapFieldTypeToPostgreSQL(field);
        
        // Quote column names to handle reserved words like 'to'
        columnDefinitions.push(`"${columnName}" ${columnType}`);
      }
    }
    
    const createTableSQL = `CREATE TABLE IF NOT EXISTS "${tableName}" (${columnDefinitions.join(', ')})`;
    await this.importDb.executeSQL(createTableSQL);
    
    return {
      name: tableName,
      columns: columnDefinitions.length,
      originalName: table.name
    };
  }

  /**
   * Map Airtable field types to PostgreSQL types with ENUM support.
   */
  mapFieldTypeToPostgreSQL(field) {
    switch (field.type) {
      case 'singleSelect':
        if (field.options?.choices?.length <= 20) {
          return `${field.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_enum`;
        }
        return 'TEXT';
      case 'multipleSelects':
        return 'TEXT[]';
      case 'number':
        return 'NUMERIC';
      case 'date':
        return 'DATE';
      case 'dateTime':
        return 'TIMESTAMP';
      case 'checkbox':
        return 'BOOLEAN';
      case 'multipleRecordLinks':
        return 'TEXT[]'; // Will be enhanced with foreign keys later
      default:
        return 'TEXT';
    }
  }

  /**
   * Create foreign key constraint for relationship.
   */
  async createForeignKeyConstraint(relationship, progressCallback = null) {
    this.emitProgress(`   🔗 Creating FK: ${relationship.sourceTable}.${relationship.sourceField} → ${relationship.targetTable}`, 'creating-foreign-keys', progressCallback);
    
    const sourceTable = relationship.sourceTable.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const targetTable = relationship.targetTable.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const sourceColumn = relationship.sourceField.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    const constraintName = `fk_${sourceTable}_${sourceColumn}`;
    const alterTableSQL = `ALTER TABLE ${sourceTable} ADD CONSTRAINT ${constraintName} FOREIGN KEY (${sourceColumn}) REFERENCES ${targetTable}(id)`;
    
    await this.importDb.executeSQL(alterTableSQL);
    
    return {
      type: 'foreign_key',
      sourceTable,
      targetTable,
      sourceColumn,
      constraintName
    };
  }

  /**
   * Create junction table for many-to-many relationship.
   */
  async createJunctionTable(relationship, progressCallback = null) {
    this.emitProgress(`   🔄 Creating junction table for M:N relationship: ${relationship.sourceTable} ↔ ${relationship.targetTable}`, 'creating-junction-tables', progressCallback);
    
    const sourceTable = relationship.sourceTable.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const targetTable = relationship.targetTable.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const junctionTableName = `${sourceTable}_${targetTable}_junction`;
    
    const createJunctionSQL = `
      CREATE TABLE IF NOT EXISTS ${junctionTableName} (
        id SERIAL PRIMARY KEY,
        ${sourceTable}_id INTEGER REFERENCES ${sourceTable}(id) ON DELETE CASCADE,
        ${targetTable}_id INTEGER REFERENCES ${targetTable}(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(${sourceTable}_id, ${targetTable}_id)
      )
    `;
    
    await this.importDb.executeSQL(createJunctionSQL);
    
    return {
      type: 'junction_table',
      name: junctionTableName,
      sourceTable,
      targetTable
    };
  }
}

module.exports = FullImportWorkflowService;