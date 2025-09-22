/**
 * Dynamic Database Service for Airtable Import Destinations
 * 
 * This service manages connections to different target databases where
 * imported Airtable data will be stored. Each import can go to a different
 * database (local SQLite, external PostgreSQL, etc.)
 */

const { Pool } = require('pg');
const sqlite3 = require('sqlite3');
const path = require('path');
const fs = require('fs').promises;

/**
 * Dynamic Database Service for Import Destinations
 * 
 * Handles creating and managing connections to various target databases
 * where imported Airtable data will be stored. Supports both PostgreSQL
 * and SQLite destinations based on configuration.
 */
class ImportDestinationService {
  constructor() {
    this.connections = new Map(); // Store active connections
    this.dataDirectory = path.join(process.cwd(), 'data', 'imports');
  }

  /**
   * Ensure the data directory exists for local database files
   */
  async ensureDataDirectory() {
    try {
      await fs.mkdir(this.dataDirectory, { recursive: true });
      console.log(`📁 Data directory ensured: ${this.dataDirectory}`);
    } catch (error) {
      console.error('❌ Failed to create data directory:', error.message);
      throw error;
    }
  }

  /**
   * Connect to a target database based on configuration
   * 
   * @param {Object} config - Database configuration
   * @param {string} config.type - Database type ('postgresql' | 'sqlite')
   * @param {string} config.connectionString - Connection string or file path
   * @param {string} config.identifier - Unique identifier for this connection
   * @returns {Promise<Object>} Database connection object
   */
  async connectToTarget(config) {
    const { type, connectionString, identifier } = config;

    // Check if we already have this connection
    if (this.connections.has(identifier)) {
      console.log(`🔄 Reusing existing connection: ${identifier}`);
      return this.connections.get(identifier);
    }

    let connection;

    if (type === 'postgresql') {
      connection = await this.connectPostgreSQL(connectionString, identifier);
    } else if (type === 'sqlite') {
      connection = await this.connectSQLite(connectionString, identifier);
    } else {
      throw new Error(`Unsupported database type: ${type}`);
    }

    // Store the connection for reuse
    this.connections.set(identifier, connection);
    console.log(`✅ Connected to ${type} database: ${identifier}`);

    return connection;
  }

  /**
   * Connect to PostgreSQL database
   * 
   * @param {string} connectionString - PostgreSQL connection string
   * @param {string} identifier - Connection identifier
   * @returns {Promise<Object>} PostgreSQL connection
   */
  async connectPostgreSQL(connectionString, identifier) {
    try {
      const pool = new Pool({
        connectionString,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 5, // Limit connections per import destination
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Test the connection
      await pool.query('SELECT NOW()');

      console.log(`🐘 PostgreSQL connected for import: ${identifier}`);
      
      return {
        type: 'postgresql',
        identifier,
        pool,
        query: async (sql, params = []) => {
          const result = await pool.query(sql, params);
          return result;
        },
        disconnect: async () => {
          await pool.end();
          this.connections.delete(identifier);
          console.log(`🔌 PostgreSQL disconnected: ${identifier}`);
        }
      };
    } catch (error) {
      console.error(`❌ PostgreSQL connection failed for ${identifier}:`, error.message);
      throw error;
    }
  }

  /**
   * Connect to SQLite database (local file)
   * 
   * @param {string} filename - SQLite filename or path
   * @param {string} identifier - Connection identifier
   * @returns {Promise<Object>} SQLite connection
   */
  async connectSQLite(filename, identifier) {
    try {
      await this.ensureDataDirectory();

      // Create full path for SQLite file
      const dbPath = filename.startsWith('/') || filename.includes(':') 
        ? filename 
        : path.join(this.dataDirectory, `${filename}.sqlite`);

      return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
          if (err) {
            console.error(`❌ SQLite connection failed for ${identifier}:`, err.message);
            reject(err);
          } else {
            console.log(`📁 SQLite connected for import: ${identifier} (${dbPath})`);
            
            const connection = {
              type: 'sqlite',
              identifier,
              db,
              path: dbPath,
              query: (sql, params = []) => {
                return new Promise((queryResolve, queryReject) => {
                  if (sql.trim().toUpperCase().startsWith('SELECT')) {
                    db.all(sql, params, (err, rows) => {
                      if (err) queryReject(err);
                      else queryResolve({ rows });
                    });
                  } else {
                    db.run(sql, params, function(err) {
                      if (err) queryReject(err);
                      else queryResolve({ rowCount: this.changes, lastID: this.lastID });
                    });
                  }
                });
              },
              disconnect: () => {
                return new Promise((discResolve) => {
                  db.close((err) => {
                    if (err) console.error(`❌ SQLite close error for ${identifier}:`, err);
                    this.connections.delete(identifier);
                    console.log(`🔌 SQLite disconnected: ${identifier}`);
                    discResolve();
                  });
                });
              }
            };

            resolve(connection);
          }
        });
      });
    } catch (error) {
      console.error(`❌ SQLite setup failed for ${identifier}:`, error.message);
      throw error;
    }
  }

  /**
   * Create a table in the target database for imported Airtable data
   * 
   * @param {Object} connection - Database connection
   * @param {string} tableName - Name of the table to create
   * @param {Object[]} fields - Airtable field definitions
   * @returns {Promise<string>} Created table name
   */
  async createImportTable(connection, tableName, fields) {
    const sanitizedTableName = this.sanitizeTableName(tableName);
    
    // Build column definitions based on Airtable field types
    const columnDefinitions = fields.map(field => {
      const columnName = this.sanitizeColumnName(field.name);
      const columnType = this.mapAirtableTypeToSQL(field.type, connection.type);
      return `"${columnName}" ${columnType}`;
    }).join(', ');

    // Create table SQL based on database type
    const createTableSQL = connection.type === 'sqlite' 
      ? `CREATE TABLE IF NOT EXISTS "${sanitizedTableName}" (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          airtable_id TEXT UNIQUE,
          airtable_created_time TEXT,
          imported_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          ${columnDefinitions}
        )`
      : `CREATE TABLE IF NOT EXISTS "${sanitizedTableName}" (
          id SERIAL PRIMARY KEY,
          airtable_id VARCHAR(255) UNIQUE,
          airtable_created_time TIMESTAMP,
          imported_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          ${columnDefinitions}
        )`;

    try {
      await connection.query(createTableSQL);
      console.log(`✅ Import table created: ${sanitizedTableName} in ${connection.identifier}`);
      return sanitizedTableName;
    } catch (error) {
      console.error(`❌ Failed to create import table ${sanitizedTableName}:`, error.message);
      throw error;
    }
  }

  /**
   * Insert Airtable records into target database
   * 
   * @param {Object} connection - Database connection
   * @param {string} tableName - Target table name
   * @param {Object[]} records - Airtable records to insert
   * @returns {Promise<number>} Number of inserted records
   */
  async insertImportRecords(connection, tableName, records) {
    if (!records || records.length === 0) {
      return 0;
    }

    const sanitizedTableName = this.sanitizeTableName(tableName);
    let insertedCount = 0;

    for (const record of records) {
      try {
        const fields = record.fields || {};
        const columns = Object.keys(fields).map(key => this.sanitizeColumnName(key));
        const values = Object.values(fields).map(value => this.serializeValue(value));

        if (columns.length === 0) continue;

        const placeholders = connection.type === 'sqlite'
          ? values.map(() => '?').join(', ')
          : values.map((_, index) => `$${index + 4}`).join(', '); // Start from $4 because of first 3 params

        const columnNames = columns.map(col => `"${col}"`).join(', ');

        const insertSQL = connection.type === 'sqlite'
          ? `INSERT OR REPLACE INTO "${sanitizedTableName}" 
             (airtable_id, airtable_created_time, imported_at, ${columnNames}) 
             VALUES (?, ?, ?, ${placeholders})`
          : `INSERT INTO "${sanitizedTableName}" 
             (airtable_id, airtable_created_time, imported_at, ${columnNames})
             VALUES ($1, $2, $3, ${placeholders})
             ON CONFLICT (airtable_id) DO UPDATE SET
             ${columns.map((col, index) => `"${col}" = $${index + 4}`).join(', ')},
             updated_at = ${connection.type === 'sqlite' ? 'CURRENT_TIMESTAMP' : 'NOW()'}`;

        const queryParams = [
          record.id,
          record.createdTime || new Date().toISOString(),
          new Date().toISOString(),
          ...values
        ];

        await connection.query(insertSQL, queryParams);
        insertedCount++;
      } catch (error) {
        console.error(`❌ Error inserting record ${record.id}:`, error.message);
      }
    }

    console.log(`✅ Inserted ${insertedCount} records into ${sanitizedTableName} (${connection.identifier})`);
    return insertedCount;
  }

  /**
   * Map Airtable field types to SQL column types
   * 
   * @param {string} airtableType - Airtable field type
   * @param {string} dbType - Database type ('postgresql' | 'sqlite')
   * @returns {string} SQL column type
   */
  mapAirtableTypeToSQL(airtableType, dbType) {
    const postgresMapping = {
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
      'multipleSelects': 'TEXT',
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
      'modifiedBy': 'JSONB'
    };

    const sqliteMapping = {
      'singleLineText': 'TEXT',
      'multilineText': 'TEXT',
      'richText': 'TEXT',
      'email': 'TEXT',
      'url': 'TEXT',
      'phoneNumber': 'TEXT',
      'number': 'REAL',
      'currency': 'REAL',
      'percent': 'REAL',
      'date': 'TEXT',
      'dateTime': 'TEXT',
      'checkbox': 'INTEGER',
      'singleSelect': 'TEXT',
      'multipleSelects': 'TEXT',
      'formula': 'TEXT',
      'rollup': 'TEXT',
      'lookup': 'TEXT',
      'attachment': 'TEXT',
      'barcode': 'TEXT',
      'rating': 'INTEGER',
      'duration': 'INTEGER',
      'autoNumber': 'INTEGER',
      'createdTime': 'TEXT',
      'modifiedTime': 'TEXT',
      'createdBy': 'TEXT',
      'modifiedBy': 'TEXT'
    };

    const mapping = dbType === 'sqlite' ? sqliteMapping : postgresMapping;
    return mapping[airtableType] || (dbType === 'sqlite' ? 'TEXT' : 'TEXT');
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

  /**
   * Get list of available local database files
   * 
   * @returns {Promise<string[]>} List of database file names
   */
  async getLocalDatabases() {
    try {
      await this.ensureDataDirectory();
      const files = await fs.readdir(this.dataDirectory);
      return files.filter(file => file.endsWith('.sqlite'));
    } catch (error) {
      console.error('❌ Error reading local databases:', error.message);
      return [];
    }
  }

  /**
   * Disconnect from all active connections
   */
  async disconnectAll() {
    const disconnectPromises = Array.from(this.connections.values()).map(
      connection => connection.disconnect()
    );

    await Promise.all(disconnectPromises);
    this.connections.clear();
    console.log('🔌 All import destination connections closed');
  }

  /**
   * Get connection statistics
   * 
   * @returns {Object} Connection statistics
   */
  getConnectionStats() {
    const stats = {
      activeConnections: this.connections.size,
      connections: {}
    };

    for (const [identifier, connection] of this.connections) {
      stats.connections[identifier] = {
        type: connection.type,
        identifier: connection.identifier,
        path: connection.path || 'N/A'
      };
    }

    return stats;
  }
}

// Create singleton instance
const importDestinationService = new ImportDestinationService();

module.exports = {
  ImportDestinationService,
  importDestinationService
};