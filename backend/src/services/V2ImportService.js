/**
 * V2 Type-Aware Import Service
 * Extends the existing working ImportService with proper field type mapping
 * Uses proven connection and import logic from the original system
 */

const ImportService = require('./import');
const FieldMapperFactory = require('./fieldMappers/FieldMapperFactory');

class V2ImportService extends ImportService {
  constructor() {
    super();
    this.fieldMapperFactory = new FieldMapperFactory();
    this.importMetadata = null;
    this.currentSession = null;
  }

  /**
   * Phase 1: Create database tables with proper types using existing logic
   * Just adds field mapping on top of the proven table creation flow
   */
  async phase1CreateSchema(airtableApiKey, airtableBaseId, databaseUrl, sessionId, selectedTables = null) {
    console.log('🔗 V2 Phase 1: Creating type-aware database schema...');
    
    try {
      // Use the existing connect method that works
      const connection = await this.connect(airtableApiKey, airtableBaseId, databaseUrl);
      console.log(`✅ Connected: ${connection.message}`);

      // Discover available tables using existing working method
      const availableTables = await this.airtableService.discoverTablesWithCounts();
      console.log(`📋 Found ${availableTables.length} tables in Airtable base`);

      // Use selected tables or import all
      const tablesToProcess = selectedTables || availableTables.map(t => t.name);
      console.log(`🎯 Processing ${tablesToProcess.length} tables: ${tablesToProcess.join(', ')}`);

      const schemaResults = [];
      
      for (const tableName of tablesToProcess) {
        console.log(`\n📋 Processing table: ${tableName}`);
        
        try {
          // Get table schema using existing working method
          const tableSchema = await this.airtableService.getTableSchema(tableName);
          console.log(`   ✅ Retrieved schema: ${tableSchema.fields.length} fields`);

          // Analyze fields with our new field mappers
          const fieldAnalysis = this.fieldMapperFactory.analyzeFields(tableSchema.fields, tableName);
          console.log(`   🔍 Field analysis: ${fieldAnalysis.standardColumns.length} standard, ${fieldAnalysis.temporaryColumns.length} temporary`);

          // Create table with enhanced type mapping
          await this.createTableWithTypeMapping(tableName, tableSchema, fieldAnalysis);
          
          schemaResults.push({
            tableName,
            originalFieldCount: tableSchema.fields.length,
            standardColumns: fieldAnalysis.standardColumns.length,
            temporaryColumns: fieldAnalysis.temporaryColumns.length,
            linkFields: fieldAnalysis.linkFields.length,
            status: 'created'
          });

        } catch (error) {
          console.error(`❌ Failed to process table ${tableName}:`, error.message);
          schemaResults.push({
            tableName,
            status: 'error',
            error: error.message
          });
        }
      }

      // Store metadata for subsequent phases
      this.importMetadata = {
        sessionId,
        phase: 'schema-created',
        baseId: airtableBaseId,
        tablesProcessed: schemaResults,
        createdAt: new Date().toISOString()
      };

      console.log(`✅ Phase 1 completed: ${schemaResults.filter(r => r.status === 'created').length}/${schemaResults.length} tables created`);

      return {
        success: true,
        phase: 'schema-created',
        tablesProcessed: schemaResults.length,
        tablesCreated: schemaResults.filter(r => r.status === 'created').length,
        metadata: this.importMetadata
      };

    } catch (error) {
      console.error('❌ V2 Phase 1 failed:', error.message);
      throw new Error(`V2 Phase 1 schema creation failed: ${error.message}`);
    }
  }

  /**
   * Phase 2: Import data using existing proven logic with type transformations
   */
  async phase2ImportData(sessionId) {
    console.log('📥 V2 Phase 2: Importing data with type transformations...');
    
    try {
      if (!this.importMetadata || this.importMetadata.sessionId !== sessionId) {
        throw new Error('No schema metadata found for this session. Run Phase 1 first.');
      }

      const importResults = [];
      const successfulTables = this.importMetadata.tablesProcessed.filter(t => t.status === 'created');

      for (const tableInfo of successfulTables) {
        console.log(`\n📥 Importing data for table: ${tableInfo.tableName}`);
        
        try {
          // Use the existing proven importTable method, but with enhanced progress tracking
          const result = await this.importTableWithV2Progress(tableInfo.tableName, sessionId);
          
          importResults.push({
            tableName: tableInfo.tableName,
            status: 'completed',
            recordsImported: result.processedRecords,
            totalRecords: result.totalRecords
          });

        } catch (error) {
          console.error(`❌ Failed to import data for table ${tableInfo.tableName}:`, error.message);
          importResults.push({
            tableName: tableInfo.tableName,
            status: 'error',
            error: error.message
          });
        }
      }

      // Update metadata
      this.importMetadata.phase = 'data-imported';
      this.importMetadata.importResults = importResults;

      console.log(`✅ Phase 2 completed: ${importResults.filter(r => r.status === 'completed').length}/${importResults.length} tables imported`);

      return {
        success: true,
        phase: 'data-imported',
        tablesImported: importResults.filter(r => r.status === 'completed').length,
        totalRecords: importResults.reduce((sum, r) => sum + (r.recordsImported || 0), 0),
        results: importResults
      };

    } catch (error) {
      console.error('❌ V2 Phase 2 failed:', error.message);
      throw new Error(`V2 Phase 2 data import failed: ${error.message}`);
    }
  }

  /**
   * Enhanced table creation that uses existing logic + our field mapping
   */
  async createTableWithTypeMapping(tableName, tableSchema, fieldAnalysis) {
    // Use existing sanitization logic
    const { sanitizeTableName } = require('../utils/naming');
    const sanitizedTableName = sanitizeTableName(tableName, false);

    // Drop existing table if it exists (full overwrite mode for V2)
    await this.importDatabaseService.dropTableIfExists(sanitizedTableName);

    // Create table using existing proven method with enhanced schema
    await this.importDatabaseService.createTableFromAirtableMetadata(
      sanitizedTableName,
      {
        ...tableSchema,
        // Add our enhanced field analysis metadata
        _v2FieldAnalysis: fieldAnalysis
      }
    );

    console.log(`   ✅ Created table ${sanitizedTableName} with type-aware schema`);
  }

  /**
   * Import table data using existing proven logic with V2 progress tracking
   */
  async importTableWithV2Progress(tableName, sessionId) {
    console.log(`   📊 Using proven import logic for: ${tableName}`);
    
    // Use the existing importTable method that already works perfectly
    const result = await this.importTable(tableName, sessionId, { overwrite: true });
    
    console.log(`   ✅ Import completed: ${result.processedRecords} records`);
    return result;
  }

  /**
   * Get current session metadata
   */
  getSessionMetadata(sessionId) {
    if (this.importMetadata && this.importMetadata.sessionId === sessionId) {
      return this.importMetadata;
    }
    return null;
  }
}

module.exports = V2ImportService;