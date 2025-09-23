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

  async importTable(tableName, sessionId) {
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
        return { recordsImported: 0, tableName };
      }

      // Create table in target database using Airtable metadata
      this.emitProgress(sessionId, {
        table: tableName,
        status: 'creating_table',
        message: 'Creating database table from Airtable schema...'
      });

      // Get table schema from Airtable metadata API
      const tableSchema = await this.airtableService.getTableSchema(tableName);
      
      // Create table using metadata instead of inferring from records
      const sanitizedTableName = await this.importDatabaseService.createTableFromAirtableMetadata(
        tableName,
        tableSchema
      );

      // Insert records
      this.emitProgress(sessionId, {
        table: tableName,
        status: 'inserting',
        message: 'Inserting records into database...',
        totalRecords: records.length
      });

      const insertResult = await this.importDatabaseService.insertRecords(
        sanitizedTableName,
        records
      );

      // insertResult is just the number of inserted records
      const insertedCount = insertResult;

      this.emitProgress(sessionId, {
        table: tableName,
        status: 'completed',
        message: `Import completed successfully`,
        recordsProcessed: insertedCount,
        totalRecords: records.length
      });

      return {
        recordsImported: insertedCount,
        tableName: sanitizedTableName,
        totalRecords: records.length
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

  async importMultipleTables(tableNames, sessionId) {
    const results = [];
    
    for (const tableName of tableNames) {
      try {
        const result = await this.importTable(tableName, sessionId);
        results.push({ ...result, success: true });
      } catch (error) {
        results.push({
          tableName,
          success: false,
          error: error.message,
          recordsImported: 0
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