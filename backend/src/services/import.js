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
    
    try {
      // Test Airtable connection
      const airtableService = new AirtableService();
      airtableService.connect(airtableApiKey, airtableBaseId);
      await airtableService.testConnection();
      results.airtable = { success: true, message: 'Airtable connection successful' };
    } catch (error) {
      results.airtable = { success: false, message: error.message };
    }

    try {
      // Test database connection
      const dbService = new DatabaseService();
      await dbService.connect(databaseUrl);
      await dbService.disconnect();
      results.database = { success: true, message: 'Database connection successful' };
    } catch (error) {
      results.database = { success: false, message: error.message };
    }

    return results;
  }
}

module.exports = ImportService;