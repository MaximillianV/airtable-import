/**
 * Prisma Database Service for Airtable Import Application
 * 
 * This service provides database operations using Prisma ORM with proper
 * type safety, migrations, and model relationships. Replaces the raw SQL
 * approach with a modern, maintainable database layer.
 */

const { PrismaClient } = require('@prisma/client');

/**
 * Database Service using Prisma ORM
 * 
 * Provides high-level database operations for users, settings, import sessions,
 * and dynamic table management. Handles all database interactions through
 * Prisma models with proper type safety and relationship management.
 */
class PrismaDatabaseService {
  constructor() {
    this.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
    });
  }

  /**
   * Initialize database connection and verify connectivity
   * 
   * @returns {Promise<boolean>} Success status of connection
   */
  async connect() {
    try {
      await this.prisma.$connect();
      console.log('✅ Prisma connected to PostgreSQL successfully');
      return true;
    } catch (error) {
      console.error('❌ Prisma connection failed:', error.message);
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  /**
   * Disconnect from database and clean up connections
   */
  async disconnect() {
    await this.prisma.$disconnect();
    console.log('🔌 Prisma disconnected from database');
  }

  // ==========================================
  // USER MANAGEMENT
  // ==========================================

  /**
   * Create a new user with hashed password
   * 
   * @param {string} email - User email address
   * @param {string} hashedPassword - Already hashed password
   * @returns {Promise<Object>} Created user object
   */
  async createUser(email, hashedPassword) {
    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
        },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });
      
      console.log(`👤 User created: ${email}`);
      return user;
    } catch (error) {
      if (error.code === 'P2002') {
        throw new Error('User with this email already exists');
      }
      throw error;
    }
  }

  /**
   * Find user by email address
   * 
   * @param {string} email - User email address
   * @returns {Promise<Object|null>} User object or null if not found
   */
  async findUserByEmail(email) {
    return await this.prisma.user.findUnique({
      where: { email },
      include: {
        settings: true,
      },
    });
  }

  /**
   * Find user by ID
   * 
   * @param {number} userId - User ID
   * @returns {Promise<Object|null>} User object or null if not found
   */
  async findUserById(userId) {
    return await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        settings: true,
      },
    });
  }

  // ==========================================
  // SETTINGS MANAGEMENT
  // ==========================================

  /**
   * Get user settings by user ID
   * 
   * @param {number} userId - User ID
   * @returns {Promise<Object|null>} Settings object or null
   */
  async getSettings(userId) {
    return await this.prisma.settings.findUnique({
      where: { userId },
    });
  }

  /**
   * Create or update user settings
   * 
   * @param {number} userId - User ID
   * @param {Object} settingsData - Settings data to save
   * @returns {Promise<Object>} Updated settings object
   */
  async saveSettings(userId, settingsData) {
    return await this.prisma.settings.upsert({
      where: { userId },
      update: {
        ...settingsData,
        updatedAt: new Date(),
      },
      create: {
        userId,
        ...settingsData,
      },
    });
  }

  // ==========================================
  // IMPORT SESSION MANAGEMENT
  // ==========================================

  /**
   * Create a new import session
   * 
   * @param {number} userId - User ID
   * @param {string[]} tableNames - Array of table names to import
   * @returns {Promise<Object>} Created import session
   */
  async createImportSession(userId, tableNames) {
    return await this.prisma.importSession.create({
      data: {
        userId,
        tableNames,
        totalTables: tableNames.length,
        status: 'PENDING',
      },
      include: {
        importedTables: true,
      },
    });
  }

  /**
   * Update import session status and progress
   * 
   * @param {string} sessionId - Import session ID
   * @param {Object} updates - Update data
   * @returns {Promise<Object>} Updated import session
   */
  async updateImportSession(sessionId, updates) {
    return await this.prisma.importSession.update({
      where: { id: sessionId },
      data: {
        ...updates,
        updatedAt: new Date(),
      },
      include: {
        importedTables: true,
      },
    });
  }

  /**
   * Get import session by ID
   * 
   * @param {string} sessionId - Import session ID
   * @returns {Promise<Object|null>} Import session or null
   */
  async getImportSession(sessionId) {
    return await this.prisma.importSession.findUnique({
      where: { id: sessionId },
      include: {
        importedTables: true,
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Get all import sessions for a user
   * 
   * @param {number} userId - User ID
   * @param {number} limit - Maximum number of sessions to return
   * @returns {Promise<Object[]>} Array of import sessions
   */
  async getImportSessions(userId, limit = 50) {
    return await this.prisma.importSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        importedTables: true,
      },
    });
  }

  // ==========================================
  // IMPORTED TABLE MANAGEMENT
  // ==========================================

  /**
   * Create imported table record
   * 
   * @param {string} sessionId - Import session ID
   * @param {string} tableName - Name of the imported table
   * @param {Object} metadata - Additional table metadata
   * @returns {Promise<Object>} Created imported table record
   */
  async createImportedTable(sessionId, tableName, metadata = {}) {
    return await this.prisma.importedTable.create({
      data: {
        sessionId,
        tableName,
        airtableTableId: metadata.airtableTableId,
        recordCount: metadata.recordCount || 0,
        status: 'RUNNING',
      },
    });
  }

  /**
   * Update imported table status and metadata
   * 
   * @param {number} tableId - Imported table ID
   * @param {Object} updates - Update data
   * @returns {Promise<Object>} Updated imported table
   */
  async updateImportedTable(tableId, updates) {
    return await this.prisma.importedTable.update({
      where: { id: tableId },
      data: {
        ...updates,
        updatedAt: new Date(),
      },
    });
  }

  // ==========================================
  // AIRTABLE SCHEMA MANAGEMENT
  // ==========================================

  /**
   * Save Airtable schema information for dynamic table creation
   * 
   * @param {string} tableName - Database table name
   * @param {string} baseId - Airtable base ID
   * @param {string} airtableId - Airtable table ID
   * @param {Object} fields - Field definitions from Airtable
   * @returns {Promise<Object>} Saved schema record
   */
  async saveAirtableSchema(tableName, baseId, airtableId, fields) {
    return await this.prisma.airtableSchema.upsert({
      where: { tableName },
      update: {
        baseId,
        airtableId,
        fields,
        lastSync: new Date(),
        updatedAt: new Date(),
      },
      create: {
        tableName,
        baseId,
        airtableId,
        fields,
      },
    });
  }

  /**
   * Get Airtable schema by table name
   * 
   * @param {string} tableName - Database table name
   * @returns {Promise<Object|null>} Schema record or null
   */
  async getAirtableSchema(tableName) {
    return await this.prisma.airtableSchema.findUnique({
      where: { tableName },
    });
  }

  /**
   * Get all Airtable schemas for a base
   * 
   * @param {string} baseId - Airtable base ID
   * @returns {Promise<Object[]>} Array of schema records
   */
  async getAirtableSchemas(baseId) {
    return await this.prisma.airtableSchema.findMany({
      where: { baseId },
      orderBy: { lastSync: 'desc' },
    });
  }

  // ==========================================
  // DYNAMIC TABLE OPERATIONS
  // ==========================================

  /**
   * Create a dynamic table for imported Airtable data
   * 
   * This method creates actual PostgreSQL tables to store the imported data.
   * Table names are sanitized and columns are created based on Airtable fields.
   * 
   * @param {string} tableName - Sanitized table name
   * @param {Object[]} fields - Airtable field definitions
   * @returns {Promise<boolean>} Success status
   */
  async createDynamicTable(tableName, fields) {
    try {
      // Build column definitions based on Airtable field types
      const columns = fields.map(field => {
        const columnName = this.sanitizeColumnName(field.name);
        const columnType = this.mapAirtableTypeToPostgreSQL(field.type);
        return `"${columnName}" ${columnType}`;
      }).join(', ');

      // Add standard columns for all imported tables
      const standardColumns = [
        '"airtable_id" VARCHAR(255) UNIQUE',
        '"airtable_created_time" TIMESTAMP',
        '"imported_at" TIMESTAMP DEFAULT NOW()',
        '"updated_at" TIMESTAMP DEFAULT NOW()'
      ].join(', ');

      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS "${tableName}" (
          "id" SERIAL PRIMARY KEY,
          ${columns},
          ${standardColumns}
        )
      `;

      await this.prisma.$executeRawUnsafe(createTableSQL);
      console.log(`✅ Dynamic table created: ${tableName}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to create dynamic table ${tableName}:`, error.message);
      throw error;
    }
  }

  /**
   * Insert data into a dynamic table
   * 
   * @param {string} tableName - Target table name
   * @param {Object[]} records - Array of records to insert
   * @returns {Promise<number>} Number of inserted records
   */
  async insertIntoDynamicTable(tableName, records) {
    if (!records || records.length === 0) {
      return 0;
    }

    try {
      // Build parameterized insert query
      const columns = Object.keys(records[0]);
      const columnNames = columns.map(col => `"${this.sanitizeColumnName(col)}"`).join(', ');
      
      // Debug logging for email templates troubleshooting
      if (tableName.toLowerCase().includes('email') || tableName.toLowerCase().includes('template')) {
        console.log(`🔍 Debug: Inserting ${records.length} records into ${tableName}`);
        console.log(`🔍 Debug: Columns: ${columns.join(', ')}`);
        console.log(`🔍 Debug: First record sample:`, JSON.stringify(records[0], null, 2));
      }
      
      const values = records.map((record, index) => {
        const placeholders = columns.map((_, colIndex) => `$${index * columns.length + colIndex + 1}`);
        return `(${placeholders.join(', ')})`;
      }).join(', ');

      const insertSQL = `
        INSERT INTO "${tableName}" (${columnNames})
        VALUES ${values}
        ON CONFLICT ("airtable_id") DO UPDATE SET
        ${columns.map(col => `"${this.sanitizeColumnName(col)}" = EXCLUDED."${this.sanitizeColumnName(col)}"`).join(', ')},
        "updated_at" = NOW()
      `;

      // Flatten all values for parameterized query
      const flatValues = records.flatMap(record => columns.map(col => {
        const value = record[col];
        // Handle null/undefined values properly
        if (value === null || value === undefined) {
          return null;
        }
        // Handle multiline text and special characters in email templates
        if (typeof value === 'string' && (value.includes('\n') || value.includes('\r'))) {
          // Keep the string as-is, Prisma will handle escaping
          return value;
        }
        return value;
      }));

      // Debug logging for parameter mismatch issues
      const expectedParams = columns.length * records.length;
      if (flatValues.length !== expectedParams) {
        console.error(`❌ Parameter mismatch for ${tableName}: expected ${expectedParams}, got ${flatValues.length}`);
        console.error(`Records: ${records.length}, Columns: ${columns.length}`);
        throw new Error(`Parameter count mismatch: expected ${expectedParams}, got ${flatValues.length}`);
      }

      if (tableName.toLowerCase().includes('email') || tableName.toLowerCase().includes('template')) {
        console.log(`🔍 Debug: SQL query length: ${insertSQL.length}`);
        console.log(`🔍 Debug: Parameters count: ${flatValues.length}`);
        console.log(`🔍 Debug: First few parameters:`, flatValues.slice(0, 5));
      }

      await this.prisma.$executeRawUnsafe(insertSQL, ...flatValues);
      console.log(`✅ Inserted ${records.length} records into ${tableName}`);
      return records.length;
    } catch (error) {
      console.error(`❌ Failed to insert into dynamic table ${tableName}:`, error.message);
      
      // Enhanced error logging for debugging
      if (tableName.toLowerCase().includes('email') || tableName.toLowerCase().includes('template')) {
        console.error(`🔍 Debug: Error details for ${tableName}:`);
        console.error(`Records count: ${records.length}`);
        console.error(`Columns: ${Object.keys(records[0] || {}).join(', ')}`);
        console.error(`Error type: ${error.constructor.name}`);
        console.error(`Error code: ${error.code}`);
      }
      
      throw error;
    }
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  /**
   * Sanitize column names for PostgreSQL
   * 
   * @param {string} name - Original column name
   * @returns {string} Sanitized column name
   */
  sanitizeColumnName(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/^(\d)/, '_$1') // Ensure doesn't start with number
      .substring(0, 63); // PostgreSQL column name limit
  }

  /**
   * Map Airtable field types to PostgreSQL column types
   * 
   * @param {string} airtableType - Airtable field type
   * @returns {string} PostgreSQL column type
   */
  mapAirtableTypeToPostgreSQL(airtableType) {
    const typeMapping = {
      'singleLineText': 'TEXT',
      'multilineText': 'TEXT',
      'richText': 'TEXT',
      'email': 'VARCHAR(255)',
      'url': 'TEXT',
      'phoneNumber': 'VARCHAR(50)',
      'number': 'DECIMAL',
      'currency': 'DECIMAL(15,2)',
      'percent': 'DECIMAL(5,4)',
      'date': 'DATE',
      'dateTime': 'TIMESTAMP',
      'checkbox': 'BOOLEAN',
      'singleSelect': 'VARCHAR(255)',
      'multipleSelects': 'TEXT[]',
      'formula': 'TEXT',
      'rollup': 'TEXT',
      'lookup': 'TEXT',
      'attachment': 'JSONB',
      'barcode': 'TEXT',
      'rating': 'INTEGER',
      'duration': 'INTEGER',
      'autoNumber': 'INTEGER',
      'createdTime': 'TIMESTAMP',
      'modifiedTime': 'TIMESTAMP',
      'createdBy': 'JSONB',
      'modifiedBy': 'JSONB',
      'multipleLookupValues': 'JSONB',
      'multipleRecordLinks': 'JSONB'
    };

    return typeMapping[airtableType] || 'TEXT';
  }

  /**
   * Get database statistics and health information
   * 
   * @returns {Promise<Object>} Database statistics
   */
  async getDatabaseStats() {
    try {
      const [
        userCount,
        sessionCount,
        tableCount,
        schemaCount
      ] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.importSession.count(),
        this.prisma.importedTable.count(),
        this.prisma.airtableSchema.count()
      ]);

      return {
        users: userCount,
        importSessions: sessionCount,
        importedTables: tableCount,
        airtableSchemas: schemaCount,
        status: 'healthy',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Create singleton instance
const prismaDatabaseService = new PrismaDatabaseService();

module.exports = {
  PrismaDatabaseService,
  prismaDatabaseService
};