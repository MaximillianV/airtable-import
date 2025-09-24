const AirtableService = require('./airtable');
const { ImportDatabaseService } = require('./importDatabase');
const { sanitizeTableName, sanitizeColumnName } = require('../utils/naming');

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
    // Emit to local callbacks for backward compatibility
    const callback = this.progressCallbacks.get(sessionId);
    if (callback) {
      callback(data);
    }
    
    // Emit to Socket.IO for real-time updates in frontend
    if (global.socketIO) {
      const progressData = {
        sessionId,
        table: data.table,
        status: data.status,
        message: data.message,
        recordsProcessed: data.recordsProcessed || 0,
        totalRecords: data.totalRecords || 0,
        skippedRecords: data.skippedRecords || 0,
        progress: data.totalRecords > 0 ? Math.round((data.recordsProcessed || 0) / data.totalRecords * 100) : 0,
        timestamp: new Date().toISOString()
      };
      
      global.socketIO.to(`progress-${sessionId}`).emit('import-progress', progressData);
      
      // Debug logging if enabled - send to frontend debug console
      if (global.debugMode) {
        console.log(`🔄 Progress emitted for session ${sessionId}:`, progressData);
        this.debugLog(sessionId, 'info', `${data.status.toUpperCase()}: ${data.message}`, {
          table: data.table,
          progress: progressData.progress + '%',
          records: `${data.recordsProcessed || 0}/${data.totalRecords || 0}`
        });
      }
    }
  }

  /**
   * Sends debug messages to the frontend debug console via Socket.IO.
   * Only sends messages when debug mode is enabled globally.
   */
  debugLog(sessionId, level, message, data = null) {
    if (global.debugMode && global.socketIO && sessionId) {
      const debugData = {
        sessionId,
        level, // 'info', 'warn', 'error', 'success'
        message,
        data,
        timestamp: new Date().toISOString()
      };
      
      global.socketIO.to(`progress-${sessionId}`).emit('debug-log', debugData);
      console.log(`🐛 [${level.toUpperCase()}] ${message}`, data ? data : '');
    }
  }

  async importTable(tableName, sessionId, options = {}) {
    const { overwrite = false } = options;
    
    try {
      console.log(`📋 ImportService.importTable called for: ${tableName} (session: ${sessionId}, overwrite: ${overwrite})`);
      
      // Send debug log to frontend if debug mode is enabled
      this.debugLog(sessionId, 'info', `🚀 Starting import for table: ${tableName}`, {
        tableName,
        overwrite,
        sessionId
      });
      
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
      
      console.log(`✅ Records fetched from Airtable table '${tableName}': ${records ? records.length : 0} records`);
      
      // Send debug log to frontend
      this.debugLog(sessionId, 'info', `✅ Fetched ${records ? records.length : 0} records from Airtable table: ${tableName}`, {
        tableName,
        recordCount: records ? records.length : 0,
        hasRecords: !!(records && records.length > 0)
      });

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
      // Using snake_case conversion while preserving plural/singular forms from Airtable
      const sanitizedTableName = sanitizeTableName(tableName, false); // false = preserve plural/singular as-is
      console.log(`🏷️  Table name conversion: "${tableName}" → "${sanitizedTableName}"`);
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

      // Log successful completion
      console.log(`✅ Successfully completed import for table '${tableName}': ${insertResult.insertedCount} records inserted`);
      
      // Send debug log to frontend
      this.debugLog(sessionId, 'success', `✅ Successfully imported table: ${tableName}`, {
        tableName,
        processedRecords: insertResult.insertedCount,
        totalRecords: records.length,
        mode: 'import'
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
      console.error(`❌ Error importing table '${tableName}':`, error.message);
      
      // Send debug log to frontend
      this.debugLog(sessionId, 'error', `❌ Error importing table: ${tableName}`, {
        tableName,
        error: error.message,
        stack: error.stack
      });
      
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
    
    console.log(`🔄 ImportService.importMultipleTables called with:`, {
      sessionId,
      tableCount: tableNames.length,
      tables: tableNames,
      overwrite,
      debugMode: global.debugMode
    });
    
    // Send debug log to frontend if debug mode is enabled
    this.debugLog(sessionId, 'info', `Starting import of ${tableNames.length} tables`, {
      tables: tableNames,
      overwrite,
      debugMode: global.debugMode
    });
    
    // Emit initial progress showing all tables waiting
    for (let i = 0; i < tableNames.length; i++) {
      const tableName = tableNames[i];
      this.emitProgress(sessionId, {
        table: tableName,
        status: 'waiting',
        message: `Waiting in queue (${i + 1} of ${tableNames.length})...`,
        recordsProcessed: 0,
        totalRecords: 0,
        position: i + 1,
        totalTables: tableNames.length
      });
    }
    
    // Process tables sequentially
    for (let i = 0; i < tableNames.length; i++) {
      const tableName = tableNames[i];
      
      try {
        // Emit status showing current table is starting
        this.emitProgress(sessionId, {
          table: tableName,
          status: 'starting',
          message: `Starting import (${i + 1} of ${tableNames.length})...`,
          recordsProcessed: 0,
          totalRecords: 0,
          position: i + 1,
          totalTables: tableNames.length
        });
        
        if (global.debugMode) {
          console.log(`🔄 Starting import for table ${i + 1}/${tableNames.length}: ${tableName}`);
        }
        
        const result = await this.importTable(tableName, sessionId, { overwrite });
        results.push(result); // Result already includes success: true
        
        if (global.debugMode) {
          console.log(`✅ Completed import for table ${tableName}:`, {
            success: result.success,
            records: result.processedRecords,
            mode: result.mode
          });
        }
        
      } catch (error) {
        console.error(`❌ Failed to import table ${tableName}:`, error.message);
        
        // Emit error status for this table
        this.emitProgress(sessionId, {
          table: tableName,
          status: 'error',
          message: `Import failed: ${error.message}`,
          recordsProcessed: 0,
          totalRecords: 0,
          position: i + 1,
          totalTables: tableNames.length,
          error: error.message
        });
        
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