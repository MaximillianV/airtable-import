/**
 * Type-Aware Import Service
 * 
 * New import service that properly handles Airtable field types
 * and creates a solid foundation for relationship analysis.
 * 
 * Phase 1: Schema Creation - Creates tables with correct data types
 * Phase 2: Raw Data Import - Imports all data with proper transformations
 * 
 * Temporary link and select fields are created for later processing
 * by the Relationship Analyzer and Schema Applier.
 */

const AirtableService = require('./airtable');
const ImportDatabaseService = require('./importDatabase');
const FieldMapperFactory = require('./fieldMappers/FieldMapperFactory');

class TypeAwareImportService {
  constructor() {
    this.airtableService = null;
    this.importDb = null;
    this.fieldMapperFactory = new FieldMapperFactory();
    this.importMetadata = null;
  }

  /**
   * Phase 1: Connect to services and create database schema with proper types
   */
  async phase1CreateSchema(airtableApiKey, airtableBaseId, databaseUrl) {
    console.log('🔗 Phase 1: Creating type-aware database schema...');
    
    try {
      // Initialize services
      this.airtableService = new AirtableService();
      this.airtableService.connect(airtableApiKey, airtableBaseId);
      this.importDb = new ImportDatabaseService();
      await this.importDb.connect(databaseUrl, airtableBaseId);

      console.log(`✅ Connected to import database: ${this.importDb.location}`);

      // Discover Airtable schema with full field type information
      console.log('🔍 Discovering Airtable schema...');
      const tables = await this.airtableService.discoverTablesWithCounts();
      
      const schemaAnalysis = {
        baseId: airtableBaseId,
        totalTables: tables.length,
        totalFields: 0,
        fieldTypeDistribution: {},
        tables: {}
      };

      // Analyze each table and create PostgreSQL schema
      for (const table of tables) {
        console.log(`   📋 Analyzing table: ${table.name}`);
        
        // Get detailed field information
        const schema = await this.airtableService.getTableSchema(table.name);
        const fields = schema.fields;
        schemaAnalysis.totalFields += fields.length;
        
        // Analyze field types
        const fieldAnalysis = this.fieldMapperFactory.analyzeFields(fields, table.name);
        
        // Track field type distribution
        fields.forEach(field => {
          schemaAnalysis.fieldTypeDistribution[field.type] = 
            (schemaAnalysis.fieldTypeDistribution[field.type] || 0) + 1;
        });

        // Create PostgreSQL table with proper column types
        await this.createTableWithTypes(table, fields, fieldAnalysis);
        
        schemaAnalysis.tables[table.name] = {
          airtableId: table.id,
          fieldCount: fields.length,
          linkFields: fieldAnalysis.linkFields.length,
          selectFields: fieldAnalysis.selectFields.length,
          computedFields: fieldAnalysis.computedFields.length,
          temporaryColumns: fieldAnalysis.temporaryColumns.length,
          standardColumns: fieldAnalysis.standardColumns.length
        };
      }

      // Store import metadata for later phases
      this.importMetadata = {
        ...schemaAnalysis,
        createdAt: new Date().toISOString(),
        phase: 'schema-created'
      };

      console.log('✅ Phase 1 complete: Type-aware schema created');
      console.log(`   📊 ${schemaAnalysis.totalTables} tables, ${schemaAnalysis.totalFields} fields`);
      console.log(`   🔗 ${Object.values(schemaAnalysis.tables).reduce((sum, t) => sum + t.linkFields, 0)} link fields for relationship analysis`);
      
      return {
        success: true,
        phase: 'schema-created',
        metadata: this.importMetadata
      };

    } catch (error) {
      console.error('❌ Phase 1 failed:', error.message);
      throw new Error(`Phase 1 schema creation failed: ${error.message}`);
    }
  }

  /**
   * Phase 2: Import all raw data from Airtable with proper type transformations
   */
  async phase2ImportData() {
    console.log('📥 Phase 2: Importing raw data with type transformations...');
    
    if (!this.importMetadata || this.importMetadata.phase !== 'schema-created') {
      throw new Error('Phase 1 must be completed before Phase 2');
    }

    try {
      const importResults = {
        totalRecords: 0,
        tableResults: {},
        errors: []
      };

      // Import data for each table
      for (const [tableName, tableInfo] of Object.entries(this.importMetadata.tables)) {
        console.log(`   📋 Importing data for table: ${tableName}`);
        
        try {
          // Get all records from Airtable
          const records = await this.airtableService.getTableRecords(tableName);
          console.log(`      📊 Retrieved ${records.length} records`);

          if (records.length > 0) {
            // Get field definitions for this table
            const schema = await this.airtableService.getTableSchema(tableName);
            const fields = schema.fields;
            
            // Transform and insert records
            const insertedCount = await this.insertRecordsWithTypes(tableName, records, fields);
            
            importResults.tableResults[tableName] = {
              recordsRetrieved: records.length,
              recordsInserted: insertedCount,
              success: true
            };
            
            importResults.totalRecords += insertedCount;
            console.log(`      ✅ Inserted ${insertedCount} records`);
          } else {
            importResults.tableResults[tableName] = {
              recordsRetrieved: 0,
              recordsInserted: 0,
              success: true
            };
            console.log(`      ℹ️ No records to import`);
          }

        } catch (error) {
          console.error(`      ❌ Failed to import ${tableName}:`, error.message);
          importResults.errors.push({
            table: tableName,
            error: error.message
          });
          importResults.tableResults[tableName] = {
            recordsRetrieved: 0,
            recordsInserted: 0,
            success: false,
            error: error.message
          };
        }
      }

      // Update metadata
      this.importMetadata.phase = 'data-imported';
      this.importMetadata.importResults = importResults;
      this.importMetadata.dataImportedAt = new Date().toISOString();

      console.log('✅ Phase 2 complete: Raw data imported');
      console.log(`   📊 ${importResults.totalRecords} total records imported`);
      
      if (importResults.errors.length > 0) {
        console.log(`   ⚠️ ${importResults.errors.length} table(s) had import errors`);
      }

      return {
        success: true,
        phase: 'data-imported',
        results: importResults,
        metadata: this.importMetadata
      };

    } catch (error) {
      console.error('❌ Phase 2 failed:', error.message);
      throw new Error(`Phase 2 data import failed: ${error.message}`);
    }
  }

  /**
   * Creates a PostgreSQL table with proper column types based on Airtable fields
   */
  async createTableWithTypes(table, fields, fieldAnalysis) {
    const tableName = this.sanitizeTableName(table.name);
    
    // Start with base table structure
    let createTableSQL = `CREATE TABLE IF NOT EXISTS "${tableName}" (\n`;
    createTableSQL += `  id SERIAL PRIMARY KEY,\n`;
    createTableSQL += `  airtable_id VARCHAR(255) NOT NULL UNIQUE,\n`;
    
    // Add all columns (both standard and temporary)
    const allColumns = [...fieldAnalysis.standardColumns, ...fieldAnalysis.temporaryColumns];
    
    for (const columnDef of allColumns) {
      const nullable = columnDef.nullable ? '' : ' NOT NULL';
      createTableSQL += `  "${columnDef.name}" ${columnDef.type}${nullable},\n`;
    }
    
    createTableSQL += `  created_at TIMESTAMP DEFAULT NOW(),\n`;
    createTableSQL += `  updated_at TIMESTAMP DEFAULT NOW()\n`;
    createTableSQL += `);`;

    // Execute table creation
    await this.importDb.executeSQL(createTableSQL);
    console.log(`      ✅ Created table: ${tableName}`);

    // Add constraints
    for (const columnDef of allColumns) {
      for (const constraint of columnDef.constraints || []) {
        try {
          const constraintSQL = `ALTER TABLE "${tableName}" ADD ${constraint};`;
          await this.importDb.executeSQL(constraintSQL);
        } catch (error) {
          console.warn(`      ⚠️ Failed to add constraint for ${columnDef.name}:`, error.message);
        }
      }
    }

    // Generate additional SQL (indexes, comments, etc.)
    const additionalSQL = this.fieldMapperFactory.generateAdditionalSQL(fields, tableName);
    for (const sql of additionalSQL) {
      try {
        await this.importDb.executeSQL(sql);
      } catch (error) {
        console.warn(`      ⚠️ Failed to execute additional SQL:`, error.message);
      }
    }

    // Add metadata comment
    const commentSQL = `COMMENT ON TABLE "${tableName}" IS 'Imported from Airtable table: ${table.name} (${table.id})';`;
    await this.importDb.executeSQL(commentSQL);
  }

  /**
   * Inserts records with proper type transformations
   */
  async insertRecordsWithTypes(tableName, records, fields) {
    const cleanTableName = this.sanitizeTableName(tableName);
    let insertedCount = 0;

    // Create field mapping for quick lookup
    const fieldMap = new Map();
    fields.forEach(field => {
      fieldMap.set(field.id, field);
    });

    // Process records in batches
    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      try {
        await this.insertRecordBatch(cleanTableName, batch, fields, fieldMap);
        insertedCount += batch.length;
        
        // Progress logging
        if (i % 500 === 0 && i > 0) {
          console.log(`      📊 Progress: ${i}/${records.length} records processed`);
        }
      } catch (error) {
        console.error(`      ❌ Failed to insert batch ${i}-${i + batchSize}:`, error.message);
        // Continue with next batch
      }
    }

    return insertedCount;
  }

  /**
   * Inserts a batch of records with type transformations
   */
  async insertRecordBatch(tableName, records, fields, fieldMap) {
    if (records.length === 0) return;

    // Map fields to columns
    const columnMappings = [];
    fields.forEach(field => {
      const columnDef = this.fieldMapperFactory.mapField(field, tableName);
      columnMappings.push({
        field,
        columnName: columnDef.name,
        isTemporary: columnDef.isTemporaryLinkField || 
                     columnDef.isTemporarySelectField || 
                     columnDef.isTemporaryMultiSelectField
      });
    });

    // Build INSERT statement
    const columns = ['airtable_id', ...columnMappings.map(m => `"${m.columnName}"`)];
    const placeholderRows = records.map((_, index) => {
      const baseIndex = index * columns.length;
      const placeholders = columns.map((_, colIndex) => `$${baseIndex + colIndex + 1}`);
      return `(${placeholders.join(', ')})`;
    });

    const insertSQL = `
      INSERT INTO "${tableName}" (${columns.join(', ')})
      VALUES ${placeholderRows.join(', ')}
      ON CONFLICT (airtable_id) DO UPDATE SET
        ${columnMappings.map(m => `"${m.columnName}" = EXCLUDED."${m.columnName}"`).join(', ')},
        updated_at = NOW()
    `;

    // Prepare values with type transformations
    const values = [];
    records.forEach(record => {
      // Add airtable_id first
      values.push(record.id);
      
      // Add transformed field values
      columnMappings.forEach(mapping => {
        const rawValue = record.fields[mapping.field.name];
        const transformedValue = this.fieldMapperFactory.transformValue(rawValue, mapping.field);
        values.push(transformedValue);
      });
    });

    // Execute batch insert
    await this.importDb.executeSQL(insertSQL, values);
  }

  /**
   * Sanitizes table name for PostgreSQL
   */
  sanitizeTableName(name) {
    return name
      .toLowerCase()
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/^(\d)/, '_$1')
      .substring(0, 63);
  }

  /**
   * Gets current import metadata
   */
  getImportMetadata() {
    return this.importMetadata;
  }

  /**
   * Disconnects from services
   */
  async disconnect() {
    if (this.importDb) {
      await this.importDb.disconnect();
    }
  }
}

module.exports = TypeAwareImportService;