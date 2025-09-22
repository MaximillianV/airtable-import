const AirtableService = require('./airtable');
const DatabaseService = require('./database');

class ImportService {
  constructor() {
    this.airtableService = new AirtableService();
    this.databaseService = new DatabaseService();
    this.progressCallbacks = new Map();
  }

  async connect(airtableApiKey, airtableBaseId, databaseUrl) {
    try {
      // Connect to both services
      this.airtableService.connect(airtableApiKey, airtableBaseId);
      await this.databaseService.connect(databaseUrl);
      
      return { success: true, message: 'Connected to both Airtable and database' };
    } catch (error) {
      throw new Error(`Connection failed: ${error.message}`);
    }
  }

  async disconnect() {
    await this.databaseService.disconnect();
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

      const records = await this.airtableService.getTableRecords(
        tableName,
        (progress) => this.emitProgress(sessionId, progress)
      );

      if (records.length === 0) {
        this.emitProgress(sessionId, {
          table: tableName,
          status: 'completed',
          message: 'No records found in table',
          recordsProcessed: 0
        });
        return { recordsImported: 0, tableName };
      }

      // Create table in PostgreSQL
      this.emitProgress(sessionId, {
        table: tableName,
        status: 'creating_table',
        message: 'Creating database table...'
      });

      const sanitizedTableName = await this.databaseService.createTableFromAirtableSchema(
        tableName,
        records
      );

      // Insert records
      this.emitProgress(sessionId, {
        table: tableName,
        status: 'inserting',
        message: 'Inserting records into database...',
        totalRecords: records.length
      });

      const insertedCount = await this.databaseService.insertRecords(
        sanitizedTableName,
        records
      );

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