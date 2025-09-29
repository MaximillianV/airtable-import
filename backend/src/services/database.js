/**
 * Database service that uses Prisma ORM for all database operations
 * This service provides a unified interface using the modern Prisma approach
 * instead of raw SQL queries for better type safety and maintainability
 */

// Import the Prisma database service
const { prismaDatabaseService } = require('./prismaDatabase');

/**
 * Legacy Database Service Wrapper
 * 
 * This class maintains compatibility with the existing API while
 * delegating all operations to the new Prisma-based service.
 * Eventually this wrapper can be removed once all code is updated.
 */
class DatabaseService {
  constructor() {
    this.prisma = prismaDatabaseService;
    this.dbType = 'postgresql'; // Always PostgreSQL with Prisma
  }

  /**
   * Connect to database using Prisma client
   * Maintains compatibility with the old connect(connectionString) API
   * 
   * @param {string} connectionString - Database connection string (ignored, uses DATABASE_URL)
   * @returns {Promise<boolean>} Success status
   */
  async connect(connectionString) {
    try {
      return await this.prisma.connect();
    } catch (error) {
      console.error('Database connection error:', error.message);
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  /**
   * Disconnect from database
   */
  async disconnect() {
    await this.prisma.disconnect();
  }

  /**
   * Create table from Airtable schema (legacy compatibility)
   * Now uses the Prisma dynamic table creation approach
   * 
   * @param {string} tableName - Name of the table to create
   * @param {Object[]} records - Airtable records to infer schema from
   * @returns {Promise<string>} Sanitized table name
   */
  async createTableFromAirtableSchema(tableName, records) {
    if (!records || records.length === 0) {
      throw new Error('No records provided to infer schema');
    }

    // Analyze the first few records to determine field types
    const sampleRecords = records.slice(0, Math.min(10, records.length));
    const fields = this.inferFieldsFromRecords(sampleRecords);

    // Sanitize table name
    const sanitizedTableName = this.sanitizeTableName(tableName);

    // Create the dynamic table using Prisma
    await this.prisma.createDynamicTable(sanitizedTableName, fields);

    console.log(`Table ${sanitizedTableName} created successfully with Prisma`);
    return sanitizedTableName;
  }

  /**
   * Infer field definitions from Airtable records
   * 
   * @param {Object[]} records - Airtable records
   * @returns {Object[]} Field definitions
   */
  inferFieldsFromRecords(records) {
    const fieldMap = {};
    
    records.forEach(record => {
      if (record.fields) {
        Object.entries(record.fields).forEach(([fieldName, value]) => {
          const sanitizedName = this.sanitizeColumnName(fieldName);
          
          if (!fieldMap[sanitizedName]) {
            fieldMap[sanitizedName] = {
              name: sanitizedName,
              originalName: fieldName,
              type: this.inferAirtableType(value)
            };
          }
        });
      }
    });

    return Object.values(fieldMap);
  }

  /**
   * Infer Airtable field type from value
   * 
   * @param {any} value - Field value
   * @returns {string} Airtable field type
   */
  inferAirtableType(value) {
    if (value === null || value === undefined) {
      return 'singleLineText';
    }

    if (typeof value === 'boolean') {
      return 'checkbox';
    }

    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'number' : 'currency';
    }

    if (value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)))) {
      return 'dateTime';
    }

    if (Array.isArray(value)) {
      return 'multipleSelects';
    }

    if (typeof value === 'object') {
      return 'attachment';
    }

    if (typeof value === 'string') {
      return value.length > 255 ? 'multilineText' : 'singleLineText';
    }

    return 'singleLineText';
  }

  /**
   * Insert records into table (legacy compatibility)
   * Now uses Prisma's insertIntoDynamicTable method
   * 
   * @param {string} tableName - Target table name
   * @param {Object[]} records - Records to insert
   * @returns {Promise<number>} Number of inserted records
   */
  async insertRecords(tableName, records) {
    if (!records || records.length === 0) {
      return 0;
    }

    const sanitizedTableName = this.sanitizeTableName(tableName);
    
    // Transform records to the format expected by Prisma
    const transformedRecords = records.map(record => {
      const transformedRecord = {
        airtable_id: record.id,
        airtable_created_time: record.createdTime ? new Date(record.createdTime) : new Date(),
      };

      // Add all field data with sanitized column names
      if (record.fields) {
        Object.entries(record.fields).forEach(([fieldName, value]) => {
          const sanitizedName = this.sanitizeColumnName(fieldName);
          transformedRecord[sanitizedName] = this.serializeValue(value);
        });
      }

      return transformedRecord;
    });

    try {
      return await this.prisma.insertIntoDynamicTable(sanitizedTableName, transformedRecords);
    } catch (error) {
      console.error(`Error inserting records into ${sanitizedTableName}:`, error.message);
      throw error;
    }
  }

  /**
   * Serialize complex values for database storage
   * 
   * @param {any} value - Value to serialize
   * @returns {any} Serialized value
   */
  serializeValue(value) {
    if (value === null || value === undefined) {
      return null;
    }

    if (Array.isArray(value) || (typeof value === 'object' && !(value instanceof Date))) {
      return JSON.stringify(value);
    }

    return value;
  }

  /**
   * Execute raw SQL query (legacy compatibility)
   * Delegates to Prisma's raw query capabilities
   * 
   * @param {string} sql - SQL query
   * @param {any[]} params - Query parameters
   * @returns {Promise<Object>} Query result
   */
  async query(sql, params = []) {
    try {
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        const result = await this.prisma.prisma.$queryRawUnsafe(sql, ...params);
        return { rows: result };
      } else {
        const result = await this.prisma.prisma.$executeRawUnsafe(sql, ...params);
        return { rowCount: result };
      }
    } catch (error) {
      console.error('Raw query error:', error.message);
      throw error;
    }
  }

  /**
   * Sanitize table name for database usage
   * 
   * @param {string} name - Original table name
   * @returns {string} Sanitized table name
   */
  sanitizeTableName(name) {
    return name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
  }

  /**
   * Sanitize column name for database usage
   * 
   * @param {string} name - Original column name
   * @returns {string} Sanitized column name
   */
  sanitizeColumnName(name) {
    return name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
  }

  // ==========================================
  // USER MANAGEMENT (Forward to Prisma)
  // ==========================================

  async createUser(email, hashedPassword) {
    return await this.prisma.createUser(email, hashedPassword);
  }

  async findUserByEmail(email) {
    return await this.prisma.findUserByEmail(email);
  }

  async findUserById(userId) {
    return await this.prisma.findUserById(userId);
  }

  // Settings removed - configuration moved to environment variables

  // ==========================================
  // IMPORT SESSION MANAGEMENT (Forward to Prisma)
  // ==========================================

  async createImportSession(userId, tableNames) {
    return await this.prisma.createImportSession(userId, tableNames);
  }

  async updateImportSession(sessionId, updates) {
    return await this.prisma.updateImportSession(sessionId, updates);
  }

  async getImportSession(sessionId) {
    return await this.prisma.getImportSession(sessionId);
  }

  async getImportSessions(userId, limit = 50) {
    return await this.prisma.getImportSessions(userId, limit);
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  async getDatabaseStats() {
    return await this.prisma.getDatabaseStats();
  }
}

module.exports = DatabaseService;