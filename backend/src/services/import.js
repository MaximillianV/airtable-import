const AirtableService = require('./airtable');
const ImportDatabaseService = require('./importDatabase');

class ImportService {
  constructor() {
    this.airtableService = new AirtableService();
    this.importDatabaseService = new ImportDatabaseService();
    this.progressCallbacks = new Map();
  }

  async connect(airtableApiKey, airtableBaseId, databaseUrl) {
    try {
      // Connect to both services - pass base ID to database service for naming
      this.airtableService.connect(airtableApiKey, airtableBaseId);
      const dbConnection = await this.importDatabaseService.connect(databaseUrl, airtableBaseId);
      
      return { 
        success: true, 
        message: 'Connected to both Airtable and import database',
        targetDatabase: dbConnection
      };
    } catch (error) {
      throw new Error(`Connection failed: ${error.message}`);
    }
  }

  async disconnect() {
    await this.importDatabaseService.disconnect();
  }

  addProgressCallback(sessionId, callback) {
    this.progressCallbacks.set(sessionId, callback);
  }

  removeProgressCallback(sessionId) {
    this.progressCallbacks.delete(sessionId);
  }

  emitProgress(sessionId, data) {
    const callback = this.progressCallbacks.get(sessionId);
    if (callback) {
      callback(data);
    }
  }

  async importTable(tableName, sessionId, options = {}) {
    const { overwrite = false } = options;
    
    try {
      this.emitProgress(sessionId, {
        table: tableName,
        status: 'starting',
        message: 'Starting import process...'
      });

      // Fetch records from Airtable
      this.emitProgress(sessionId, {
        table: tableName,
        status: 'fetching',
        message: 'Fetching records from Airtable...'
      });

      console.log(`🔍 About to fetch records from Airtable table: ${tableName}`);
      console.log(`🔍 Airtable service state:`, {
        hasService: !!this.airtableService,
        hasBase: !!this.airtableService?.base,
        baseId: this.airtableService?.baseId
      });

      const records = await this.airtableService.getTableRecords(
        tableName,
        (progress) => this.emitProgress(sessionId, progress)
      );

      console.log(`📊 Airtable returned:`, {
        tableName,
        recordsType: typeof records,
        recordsValue: records,
        recordsLength: records ? records.length : 'undefined'
      });

      if (!records) {
        throw new Error(`No records returned from Airtable for table '${tableName}'`);
      }

      if (records.length === 0) {
        this.emitProgress(sessionId, {
          table: tableName,
          status: 'completed',
          message: 'No records found in table',
          recordsProcessed: 0
        });
        return {
          tableName: sanitizedTableName,
          success: true,
          mode: 'empty',
          processedRecords: 0,
          skippedRecords: 0,
          totalRecords: 0,
          recordsImported: 0, // Legacy compatibility
          recordsSkipped: 0   // Legacy compatibility
        };
      }

      // Check if table already exists and handle based on overwrite flag
      const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '_');
      const tableAlreadyExists = await this.importDatabaseService.tableExists(sanitizedTableName);
      
      if (tableAlreadyExists && !overwrite) {
        // Table exists and overwrite is false - sync mode
        this.emitProgress(sessionId, {
          table: tableName,
          status: 'syncing',
          message: 'Table already exists - syncing new records only...'
        });
        
        console.log(`📊 Table '${tableName}' already exists, syncing new records (overwrite: false)`);
        
        // Skip table creation, go directly to record insertion with sync logic
        const insertResult = await this.importDatabaseService.insertRecords(
          sanitizedTableName,
          records,
          { syncMode: true } // This will skip duplicates
        );

        this.emitProgress(sessionId, {
          table: tableName,
          status: 'completed',
          message: `Sync completed successfully`,
          recordsProcessed: insertResult.insertedCount,
          totalRecords: records.length,
          skippedRecords: insertResult.skippedCount
        });

        return {
          tableName: sanitizedTableName,
          success: true,
          mode: 'sync',
          processedRecords: insertResult.insertedCount,
          updatedRecords: insertResult.updatedCount || 0,
          skippedRecords: insertResult.skippedCount,
          totalRecords: records.length,
          recordsImported: insertResult.insertedCount, // Legacy compatibility
          recordsSkipped: insertResult.skippedCount    // Legacy compatibility
        };
      } else {
        // Either table doesn't exist or overwrite is true - full import mode
        this.emitProgress(sessionId, {
          table: tableName,
          status: 'creating_table',
          message: tableAlreadyExists ? 
            'Overwriting existing table with fresh schema...' : 
            'Creating database table from Airtable schema...'
        });

        if (tableAlreadyExists && overwrite) {
          console.log(`🗑️  Table '${tableName}' exists, dropping for fresh import (overwrite: true)`);
          await this.importDatabaseService.dropTableIfExists(sanitizedTableName);
        }

        // Get table schema from Airtable metadata API
        const tableSchema = await this.airtableService.getTableSchema(tableName);
        
        // Create table using metadata instead of inferring from records
        await this.importDatabaseService.createTableFromAirtableMetadata(
          tableName,
          tableSchema
        );
      }

      // Insert records for full import mode (overwrite or new table)
      this.emitProgress(sessionId, {
        table: tableName,
        status: 'inserting',
        message: 'Inserting records into database...',
        totalRecords: records.length
      });

      const insertResult = await this.importDatabaseService.insertRecords(
        sanitizedTableName,
        records,
        { syncMode: false } // Full import mode
      );

      this.emitProgress(sessionId, {
        table: tableName,
        status: 'completed',
        message: `Import completed successfully`,
        recordsProcessed: insertResult.insertedCount,
        totalRecords: records.length
      });

      return {
        tableName: sanitizedTableName,
        success: true,
        mode: 'import',
        processedRecords: insertResult.insertedCount,
        updatedRecords: 0, // No updated records in full import mode
        skippedRecords: 0, // No skipped records in full import mode
        totalRecords: records.length,
        recordsImported: insertResult.insertedCount, // Legacy compatibility
        recordsSkipped: 0                            // Legacy compatibility
      };

    } catch (error) {
      this.emitProgress(sessionId, {
        table: tableName,
        status: 'error',
        message: error.message,
        error: error.message
      });
      throw error;
    }
  }

  async importMultipleTables(tableNames, sessionId, options = {}) {
    const { overwrite = false } = options;
    const results = [];
    
    for (const tableName of tableNames) {
      try {
        const result = await this.importTable(tableName, sessionId, { overwrite });
        results.push(result); // Result already includes success: true
      } catch (error) {
        results.push({
          tableName,
          success: false,
          mode: 'error',
          processedRecords: 0,
          updatedRecords: 0,
          skippedRecords: 0,
          totalRecords: 0,
          error: error.message,
          recordsImported: 0, // Legacy compatibility
          recordsSkipped: 0   // Legacy compatibility
        });
      }
    }

    return results;
  }

  async testConnections(airtableApiKey, airtableBaseId, databaseUrl) {
    const results = {};
    
    // Test Airtable connection
    try {
      console.log('🔍 Testing Airtable connection...');
      const airtableService = new AirtableService();
      airtableService.connect(airtableApiKey, airtableBaseId);
      const testResult = await airtableService.testConnection();
      
      results.airtable = { 
        success: true, 
        message: 'Airtable connection successful',
        details: testResult
      };
      console.log('✅ Airtable connection test passed');
    } catch (error) {
      console.log('❌ Airtable connection test failed:', error.message);
      results.airtable = { 
        success: false, 
        message: error.message,
        details: null
      };
    }

    // Test database connection using Prisma
    try {
      console.log('🔍 Testing database connection...');
      
      // Create a temporary Prisma client with the provided database URL
      const { PrismaClient } = require('@prisma/client');
      const testClient = new PrismaClient({
        datasources: {
          db: {
            url: databaseUrl
          }
        },
        log: ['error'] // Only log errors for testing
      });
      
      // Test the connection by attempting to connect
      await testClient.$connect();
      
      // Try a simple query to verify the connection works
      await testClient.$queryRaw`SELECT 1 as test`;
      
      // Clean up the test connection
      await testClient.$disconnect();
      
      // Determine database type from URL
      let dbType = 'unknown';
      if (databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')) {
        dbType = 'postgresql';
      } else if (databaseUrl.startsWith('mysql://')) {
        dbType = 'mysql';
      } else if (databaseUrl.startsWith('sqlite://') || databaseUrl.includes('.db')) {
        dbType = 'sqlite';
      }
      
      results.database = { 
        success: true, 
        message: 'Database connection successful',
        details: {
          type: dbType,
          url: databaseUrl.replace(/\/\/[^@]+@/, '//***:***@') // Hide credentials
        }
      };
      console.log('✅ Database connection test passed');
    } catch (error) {
      console.log('❌ Database connection test failed:', error.message);
      results.database = { 
        success: false, 
        message: error.message,
        details: null
      };
    }

    return results;
  }
}

module.exports = ImportService;