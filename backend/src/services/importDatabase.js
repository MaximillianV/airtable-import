/**
 * Import Target Database Service
 * 
 * Handles connections to the target database where Airtable data will be imported.
 * Supports both SQLite (default) and PostgreSQL/other databases (via URL).
 * This is separate from the main app database (Prisma) which stores metadata.
 * Automatically creates database names based on Airtable base ID.
 */

const sqlite3 = require('sqlite3').verbose();
const { Client } = require('pg');
const path = require('path');
const fs = require('fs');

class ImportDatabaseService {
  constructor() {
    this.connection = null;
    this.dbType = null;
    this.connectionString = null;
  }

  /**
   * Connect to target database for importing Airtable data.
   * If no URL is provided, creates a local SQLite database.
   * For PostgreSQL URLs, automatically creates database name based on Airtable base ID.
   * 
   * @param {string|null} databaseUrl - Database connection URL or null for SQLite
   * @param {string} airtableBaseId - Airtable base ID for database naming
   * @returns {Promise<{success: boolean, dbType: string, location: string}>}
   */
  async connect(databaseUrl, airtableBaseId) {
    try {
      if (!databaseUrl || databaseUrl.trim() === '') {
        // Default: Create local SQLite database with base ID
        return await this.connectSQLite(airtableBaseId);
      } else {
        // Custom: Connect to database with base-specific naming
        return await this.connectCustomDatabase(databaseUrl, airtableBaseId);
      }
    } catch (error) {
      console.error('Import database connection error:', error.message);
      throw new Error(`Import database connection failed: ${error.message}`);
    }
  }

  /**
   * Connect to local SQLite database (default option)
   * Creates a new database file in the data directory with base ID
   * 
   * @param {string} airtableBaseId - Airtable base ID for database naming
   * @returns {Promise<{success: boolean, dbType: string, location: string}>}
   */
  async connectSQLite(airtableBaseId) {
    // Create data directory if it doesn't exist
    const dataDir = path.join(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Generate database filename with base ID and timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseIdSafe = airtableBaseId || 'unknown';
    const dbPath = path.join(dataDir, `airtable_import_data_${baseIdSafe}_${timestamp}.sqlite`);

    return new Promise((resolve, reject) => {
      this.connection = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          reject(new Error(`SQLite connection failed: ${err.message}`));
        } else {
          this.dbType = 'sqlite';
          this.connectionString = dbPath;
          console.log(`✅ Connected to SQLite database: ${dbPath}`);
          resolve({
            success: true,
            dbType: 'sqlite',
            location: dbPath
          });
        }
      });
    });
  }

  /**
   * Connect to custom database via URL string
   * Currently supports PostgreSQL, can be extended for other databases
   * Automatically creates database name based on Airtable base ID
   * 
   * @param {string} databaseUrl - Database connection URL
   * @param {string} airtableBaseId - Airtable base ID for database naming
   * @returns {Promise<{success: boolean, dbType: string, location: string}>}
   */
  async connectCustomDatabase(databaseUrl, airtableBaseId) {
    if (databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')) {
      return await this.connectPostgreSQL(databaseUrl, airtableBaseId);
    } else {
      throw new Error(`Unsupported database URL format: ${databaseUrl}`);
    }
  }

  /**
   * Connect to PostgreSQL database with base-specific database name
   * 
   * @param {string} connectionString - PostgreSQL connection string
   * @param {string} airtableBaseId - Airtable base ID for database naming
   * @returns {Promise<{success: boolean, dbType: string, location: string}>}
   */
  async connectPostgreSQL(connectionString, airtableBaseId) {
    // Parse the connection string and modify database name
    const url = new URL(connectionString);
    const originalDatabase = url.pathname.substring(1); // Remove leading '/'
    const baseIdSafe = airtableBaseId || 'unknown';
    const newDatabaseName = `airtable_import_data_${baseIdSafe}`;
    
    // Update the URL with the new database name
    url.pathname = `/${newDatabaseName}`;
    const modifiedConnectionString = url.toString();
    
    console.log(`🎯 Connecting to base-specific database: ${newDatabaseName}`);
    
    // Configure connection with SSL settings
    let connectionConfig = { connectionString: modifiedConnectionString };
    
    // Handle different SSL scenarios
    if (modifiedConnectionString.includes('localhost') || modifiedConnectionString.includes('127.0.0.1')) {
      // Local database - disable SSL
      connectionConfig.ssl = false;
    } else {
      // Remote database - try multiple SSL strategies for DigitalOcean
      const caCertPath = path.join(__dirname, '../../data/ca-certificate.crt');
      
      // For DigitalOcean databases, try the most permissive SSL settings first
      if (modifiedConnectionString.includes('digitalocean.com')) {
        // Strategy 1: Maximum permissive SSL for DigitalOcean
        connectionConfig.ssl = {
          rejectUnauthorized: false,
          checkServerIdentity: () => undefined,
          requestCert: false,
          agent: false,
          secureProtocol: 'TLSv1_2_method'
        };
        
        // Modify connection string to use require SSL mode but don't verify
        const sslUrl = new URL(modifiedConnectionString);
        sslUrl.searchParams.set('sslmode', 'require');
        sslUrl.searchParams.set('sslcert', '');
        sslUrl.searchParams.set('sslkey', '');
        sslUrl.searchParams.set('sslrootcert', '');
        connectionConfig.connectionString = sslUrl.toString();
        
        console.log(`⚡ Using maximum permissive SSL for DigitalOcean database`);
      } else if (fs.existsSync(caCertPath)) {
        // Use the CA certificate for other remote databases
        connectionConfig.ssl = {
          rejectUnauthorized: false,
          ca: fs.readFileSync(caCertPath, 'utf8'),
          checkServerIdentity: () => undefined,
          requestCert: false,
          agent: false
        };
        console.log(`🔒 Using CA certificate for SSL connection: ${caCertPath}`);
      } else {
        // Fallback to permissive SSL if no CA certificate is available
        connectionConfig.ssl = {
          rejectUnauthorized: false,
          checkServerIdentity: () => undefined,
          requestCert: false,
          agent: false
        };
        console.log(`⚠️  No CA certificate found, using permissive SSL mode`);
      }
    }
    
    console.log(`🔧 Attempting PostgreSQL connection to ${newDatabaseName} with SSL config:`, {
      ssl: connectionConfig.ssl !== false ? 'enabled' : 'disabled',
      ca: connectionConfig.ssl && connectionConfig.ssl.ca ? 'certificate loaded' : 'no certificate',
      rejectUnauthorized: connectionConfig.ssl && connectionConfig.ssl.rejectUnauthorized,
      host: modifiedConnectionString.includes('digitalocean.com') ? 'DigitalOcean' : 'Local'
    });
    
    this.connection = new Client(connectionConfig);
    await this.connection.connect();
    
    this.dbType = 'postgresql';
    this.connectionString = modifiedConnectionString;
    
    console.log(`✅ Connected to PostgreSQL database: ${newDatabaseName}`);
    
    return {
      success: true,
      dbType: 'postgresql',
      location: `${newDatabaseName} (${url.host})`
    };
  }

  /**
   * Disconnect from the target database
   */
  async disconnect() {
    if (this.connection) {
      if (this.dbType === 'sqlite') {
        this.connection.close();
      } else if (this.dbType === 'postgresql') {
        await this.connection.end();
      }
      this.connection = null;
      console.log('✅ Disconnected from import database');
    }
  }

  /**
   * Test the database connection
   * 
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async testConnection() {
    try {
      if (!this.connection) {
        return { success: false, message: 'No connection established' };
      }

      if (this.dbType === 'sqlite') {
        // Test SQLite connection with a simple query
        return new Promise((resolve) => {
          this.connection.get('SELECT 1 as test', (err, row) => {
            if (err) {
              resolve({ success: false, message: `SQLite test failed: ${err.message}` });
            } else {
              resolve({ success: true, message: 'SQLite connection test successful' });
            }
          });
        });
      } else if (this.dbType === 'postgresql') {
        // Test PostgreSQL connection
        const result = await this.connection.query('SELECT 1 as test');
        return { success: true, message: 'PostgreSQL connection test successful' };
      }

      return { success: false, message: 'Unknown database type' };
    } catch (error) {
      return { success: false, message: `Connection test failed: ${error.message}` };
    }
  }

  /**
   * Create table from Airtable table schema using field metadata
   * 
   * @param {string} tableName - Name of the table to create
   * @param {Object} tableSchema - Airtable table schema with field definitions
   * @returns {Promise<string>} Created table name
   */
  async createTableFromAirtableMetadata(tableName, tableSchema) {
    try {
      if (!tableSchema || !tableSchema.fields || tableSchema.fields.length === 0) {
        throw new Error('No field schema provided for table creation');
      }

      console.log(`🔍 Creating table "${tableName}" from Airtable metadata with ${tableSchema.fields.length} fields`);

      // Drop table if it exists to ensure clean schema
      await this.dropTableIfExists(tableName);

      // Convert Airtable field types to SQL column definitions
      const columns = tableSchema.fields.map(field => ({
        name: field.name,
        type: this.mapAirtableTypeToSQL(field.type, field.options)
      }));
      
      // Log field mappings for debugging
      console.log(`🔍 Field type mappings for table "${tableName}":`);
      tableSchema.fields.forEach((field, index) => {
        console.log(`  - "${field.name}": ${field.type} -> ${columns[index].type}`);
      });
      
      // Build CREATE TABLE SQL
      const createTableSQL = this.buildCreateTableSQL(tableName, columns);
      
      // Execute the CREATE TABLE statement
      await this.executeSQL(createTableSQL);
      
      console.log(`✅ Created table '${tableName}' with ${columns.length} columns using metadata`);
      return tableName;
    } catch (error) {
      console.error(`❌ Failed to create table '${tableName}' from metadata:`, error.message);
      throw error;
    }
  }

  /**
   * Drop table if it exists
   * 
   * @param {string} tableName - Name of the table to drop
   */
  async dropTableIfExists(tableName) {
    try {
      const dropSQL = `DROP TABLE IF EXISTS "${tableName}"`;
      await this.executeSQL(dropSQL);
      console.log(`🗑️  Dropped existing table "${tableName}" if it existed`);
    } catch (error) {
      console.warn(`⚠️  Warning: Could not drop table "${tableName}":`, error.message);
      // Don't throw - this is not critical
    }
  }

  /**
   * Map Airtable field type to SQL column type
   * 
   * @param {string} airtableType - Airtable field type
   * @param {Object} options - Field options from Airtable
   * @returns {string} SQL column type
   */
  mapAirtableTypeToSQL(airtableType, options = {}) {
    switch (airtableType) {
      case 'singleLineText':
      case 'multilineText':
      case 'richText':
      case 'email':
      case 'url':
      case 'phoneNumber':
        return 'TEXT';
      
      case 'number':
        // Check if it's a decimal or integer based on precision
        if (options.precision && options.precision > 0) {
          return 'DECIMAL(10,2)';
        }
        return 'INTEGER';
      
      case 'currency':
        return 'DECIMAL(10,2)';
      
      case 'percent':
        return 'DECIMAL(5,4)'; // For percentage values like 0.4950
      
      case 'checkbox':
        return 'BOOLEAN';
      
      case 'date':
        return 'DATE';
      
      case 'dateTime':
        return 'TIMESTAMP';
      
      case 'singleSelect':
      case 'multipleSelects':
        return 'TEXT';
      
      case 'multipleRecordLinks':
      case 'lookup':
      case 'rollup':
      case 'formula':
        return 'TEXT'; // Store as text for complex field types
      
      case 'attachment':
        return 'JSON'; // Store attachment metadata as JSON
      
      case 'barcode':
        return 'TEXT';
      
      case 'rating':
        return 'INTEGER';
      
      case 'duration':
        return 'INTEGER'; // Duration in seconds
      
      case 'autoNumber':
        return 'INTEGER';
      
      case 'createdTime':
      case 'lastModifiedTime':
        return 'TIMESTAMP';
      
      case 'createdBy':
      case 'lastModifiedBy':
        return 'TEXT';
      
      default:
        console.warn(`⚠️  Unknown Airtable field type: ${airtableType}, defaulting to TEXT`);
        return 'TEXT';
    }
  }

  /**
   * Create table from Airtable records with automatic schema detection
   * 
   * @param {string} tableName - Name of the table to create
   * @param {Array} records - Sample Airtable records for schema inference
   * @returns {Promise<string>} Success status
   */
  async createTableFromAirtableSchema(tableName, records) {
    try {
      if (!records || records.length === 0) {
        throw new Error('No records provided for schema detection');
      }

      // Infer column types from sample records
      const columns = this.inferColumnTypes(records);
      
      // Build CREATE TABLE SQL
      const createTableSQL = this.buildCreateTableSQL(tableName, columns);
      
      // Execute the CREATE TABLE statement
      await this.executeSQL(createTableSQL);
      
      console.log(`✅ Created table '${tableName}' with ${columns.length} columns`);
      return tableName; // Return the table name, not just true
    } catch (error) {
      console.error(`❌ Failed to create table '${tableName}':`, error.message);
      throw error;
    }
  }

  /**
   * Infer column types from Airtable records
   * 
   * @param {Array} records - Airtable records
   * @returns {Array} Column definitions with names and types
   */
  inferColumnTypes(records) {
    const columns = [];
    const fieldTypes = {};

    console.log(`🔍 Analyzing ${records.length} records for type inference...`);

    // Analyze all records to determine field types
    records.forEach((record, recordIndex) => {
      if (record.fields) {
        Object.entries(record.fields).forEach(([fieldName, value]) => {
          if (!fieldTypes[fieldName]) {
            fieldTypes[fieldName] = [];
          }
          const inferredType = this.inferSQLType(value);
          fieldTypes[fieldName].push(inferredType);
          
          if (recordIndex < 3) { // Log first 3 records for debugging
            console.log(`🔍 Field "${fieldName}": value="${value}" (${typeof value}) -> type=${inferredType}`);
          }
        });
      }
    });

    // Determine the most appropriate type for each field
    Object.entries(fieldTypes).forEach(([fieldName, types]) => {
      // Count type occurrences
      const typeCount = {};
      types.forEach(type => {
        typeCount[type] = (typeCount[type] || 0) + 1;
      });
      
      // Smart type selection logic
      let chosenType;
      if (typeCount['INTEGER'] && typeCount['DECIMAL']) {
        // If we have both integers and decimals, choose DECIMAL to accommodate both
        chosenType = 'DECIMAL';
        console.log(`🔍 Field "${fieldName}": Mixed INTEGER/DECIMAL detected, choosing DECIMAL for compatibility`);
      } else if (typeCount['TEXT'] && (typeCount['INTEGER'] || typeCount['DECIMAL'])) {
        // If we have text mixed with numbers, choose TEXT to be safe
        chosenType = 'TEXT';
        console.log(`🔍 Field "${fieldName}": Mixed TEXT/NUMERIC detected, choosing TEXT for safety`);
      } else {
        // Use the most common type
        chosenType = Object.keys(typeCount).reduce((a, b) => 
          typeCount[a] > typeCount[b] ? a : b
        );
      }
      
      console.log(`🔍 Field "${fieldName}": ${JSON.stringify(typeCount)} -> chosen: ${chosenType}`);
      
      columns.push({
        name: fieldName,
        type: chosenType
      });
    });

    console.log(`🔍 Final column types:`, columns.map(c => `${c.name}:${c.type}`).join(', '));
    return columns;
  }

  /**
   * Infer SQL type from JavaScript value
   * 
   * @param {any} value - Value to analyze
   * @returns {string} SQL type
   */
  inferSQLType(value) {
    if (value === null || value === undefined) return 'TEXT';
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'INTEGER' : 'DECIMAL';
    }
    if (typeof value === 'string') {
      // Check if string represents a decimal number
      const numericValue = parseFloat(value);
      if (!isNaN(numericValue) && isFinite(numericValue)) {
        return numericValue % 1 === 0 ? 'INTEGER' : 'DECIMAL';
      }
      return 'TEXT';
    }
    if (typeof value === 'boolean') return 'BOOLEAN';
    if (value instanceof Date) return 'TIMESTAMP';
    if (Array.isArray(value)) return 'JSON';
    if (typeof value === 'object') return 'JSON';
    return 'TEXT';
  }

  /**
   * Build CREATE TABLE SQL statement
   * 
   * @param {string} tableName - Table name
   * @param {Array} columns - Column definitions
   * @returns {string} SQL statement
   */
  buildCreateTableSQL(tableName, columns) {
    const columnDefinitions = columns.map(col => {
      if (this.dbType === 'postgresql') {
        // PostgreSQL column definition
        let type = col.type;
        if (type === 'REAL') type = 'REAL';
        if (type === 'DECIMAL') type = 'DECIMAL(10,2)';
        if (type === 'JSON') type = 'JSONB';
        if (type === 'TIMESTAMP') type = 'TIMESTAMP';
        return `"${col.name}" ${type}`;
      } else {
        // SQLite column definition
        return `"${col.name}" ${col.type}`;
      }
    }).join(', ');

    return `CREATE TABLE IF NOT EXISTS "${tableName}" (
      id SERIAL PRIMARY KEY,
      ${columnDefinitions},
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`;
  }

  /**
   * Execute SQL statement
   * 
   * @param {string} sql - SQL statement
   * @param {Array} params - Parameters for prepared statement
   * @returns {Promise} Query result
   */
  async executeSQL(sql, params = []) {
    try {
      if (this.dbType === 'sqlite') {
        return new Promise((resolve, reject) => {
          if (params.length > 0) {
            this.connection.run(sql, params, function(err) {
              if (err) reject(err);
              else resolve({ changes: this.changes, lastID: this.lastID });
            });
          } else {
            this.connection.run(sql, function(err) {
              if (err) reject(err);
              else resolve({ changes: this.changes, lastID: this.lastID });
            });
          }
        });
      } else if (this.dbType === 'postgresql') {
        return await this.connection.query(sql, params);
      }
    } catch (error) {
      console.error('SQL execution error:', error.message);
      console.error('SQL:', sql);
      throw error;
    }
  }

  /**
   * Insert Airtable records into database table
   * 
   * @param {string} tableName - Target table name
   * @param {Array} records - Airtable records to insert
   * @returns {Promise<number>} Number of inserted records
   */
  async insertRecords(tableName, records) {
    try {
      if (!records || records.length === 0) {
        return 0;
      }

      let insertedCount = 0;

      for (const record of records) {
        if (record.fields) {
          // Build INSERT statement
          const fields = Object.keys(record.fields);
          const values = Object.values(record.fields);
          
          // Handle JSON values
          const processedValues = values.map(value => {
            if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
              return JSON.stringify(value);
            }
            return value;
          });

          const placeholders = this.dbType === 'postgresql' 
            ? fields.map((_, i) => `$${i + 1}`).join(', ')
            : fields.map(() => '?').join(', ');

          const fieldNames = fields.map(f => `"${f}"`).join(', ');
          const insertSQL = `INSERT INTO "${tableName}" (${fieldNames}) VALUES (${placeholders})`;

          await this.executeSQL(insertSQL, processedValues);
          insertedCount++;
        }
      }

      console.log(`✅ Inserted ${insertedCount} records into table '${tableName}'`);
      return insertedCount;
    } catch (error) {
      console.error(`❌ Failed to insert records into table '${tableName}':`, error.message);
      throw error;
    }
  }

  /**
   * Get connection information
   * 
   * @returns {Object} Connection details
   */
  getConnectionInfo() {
    return {
      dbType: this.dbType,
      connectionString: this.connectionString,
      connected: !!this.connection
    };
  }
}

module.exports = ImportDatabaseService;