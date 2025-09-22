const { Pool } = require('pg');
const sqlite3 = require('sqlite3');
const { promisify } = require('util');

class DatabaseService {
  constructor() {
    this.pool = null;
    this.sqlite = null;
    this.isTestMode = process.env.NODE_ENV === 'test';
  }

  async connect(connectionString) {
    try {
      // Use SQLite for testing, PostgreSQL for production
      if (this.isTestMode || connectionString === 'sqlite::memory:') {
        return this.connectSQLite();
      } else {
        return this.connectPostgreSQL(connectionString);
      }
    } catch (error) {
      console.error('Database connection error:', error.message);
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  async connectPostgreSQL(connectionString) {
    this.pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    // Test connection
    await this.pool.query('SELECT NOW()');
    console.log('PostgreSQL connected successfully');
    return true;
  }

  async connectSQLite() {
    return new Promise((resolve, reject) => {
      this.sqlite = new sqlite3.Database(':memory:', (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('SQLite in-memory database connected successfully');
          resolve(true);
        }
      });
    });
  }

  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    if (this.sqlite) {
      return new Promise((resolve) => {
        this.sqlite.close((err) => {
          if (err) console.error('SQLite close error:', err);
          this.sqlite = null;
          resolve();
        });
      });
    }
  }

  async createTableFromAirtableSchema(tableName, records) {
    if (!this.pool && !this.sqlite) {
      throw new Error('Database not connected');
    }

    if (!records || records.length === 0) {
      throw new Error('No records provided to infer schema');
    }

    // Analyze the first few records to determine column types
    const sampleRecords = records.slice(0, Math.min(10, records.length));
    const columns = this.inferColumnsFromRecords(sampleRecords);

    // Create table SQL
    const sanitizedTableName = this.sanitizeTableName(tableName);
    const columnDefinitions = Object.entries(columns)
      .map(([colName, colType]) => `"${this.sanitizeColumnName(colName)}" ${this.adaptColumnType(colType)}`)
      .join(', ');

    const createTableSQL = this.sqlite ? 
      // SQLite version
      `CREATE TABLE IF NOT EXISTS "${sanitizedTableName}" (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        airtable_id TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ${columnDefinitions}
      )` :
      // PostgreSQL version
      `CREATE TABLE IF NOT EXISTS "${sanitizedTableName}" (
        id SERIAL PRIMARY KEY,
        airtable_id VARCHAR(255) UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ${columnDefinitions}
      )`;

    try {
      await this.query(createTableSQL);
      console.log(`Table ${sanitizedTableName} created successfully`);
      return sanitizedTableName;
    } catch (error) {
      console.error(`Error creating table ${sanitizedTableName}:`, error.message);
      throw error;
    }
  }

  adaptColumnType(pgType) {
    if (!this.sqlite) return pgType; // Return PostgreSQL type as-is
    
    // Convert PostgreSQL types to SQLite equivalents
    const typeMap = {
      'SERIAL': 'INTEGER',
      'VARCHAR(1000)': 'TEXT',
      'VARCHAR(255)': 'TEXT',
      'INTEGER': 'INTEGER',
      'DECIMAL': 'REAL',
      'BOOLEAN': 'INTEGER',
      'TIMESTAMP': 'DATETIME',
      'JSONB': 'TEXT',
      'TEXT': 'TEXT'
    };
    
    return typeMap[pgType] || 'TEXT';
  }

  inferColumnsFromRecords(records) {
    const columns = {};
    
    records.forEach(record => {
      if (record.fields) {
        Object.entries(record.fields).forEach(([fieldName, value]) => {
          const sanitizedName = this.sanitizeColumnName(fieldName);
          
          if (!columns[sanitizedName]) {
            columns[sanitizedName] = this.inferColumnType(value);
          }
        });
      }
    });

    return columns;
  }

  inferColumnType(value) {
    if (value === null || value === undefined) {
      return 'TEXT';
    }

    if (typeof value === 'boolean') {
      return 'BOOLEAN';
    }

    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'INTEGER' : 'DECIMAL';
    }

    if (value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)))) {
      return 'TIMESTAMP';
    }

    if (Array.isArray(value)) {
      return 'JSONB';
    }

    if (typeof value === 'object') {
      return 'JSONB';
    }

    if (typeof value === 'string') {
      return value.length > 255 ? 'TEXT' : 'VARCHAR(1000)';
    }

    return 'TEXT';
  }

  sanitizeTableName(name) {
    return name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
  }

  sanitizeColumnName(name) {
    return name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
  }

  async insertRecords(tableName, records) {
    if ((!this.pool && !this.sqlite) || !records || records.length === 0) {
      return 0;
    }

    const sanitizedTableName = this.sanitizeTableName(tableName);
    let insertedCount = 0;

    for (const record of records) {
      try {
        const fields = record.fields || {};
        const columns = Object.keys(fields).map(key => this.sanitizeColumnName(key));
        const values = Object.values(fields);

        if (columns.length === 0) continue;

        const placeholders = this.sqlite ? 
          values.map(() => '?').join(', ') : 
          values.map((_, index) => `$${index + 2}`).join(', ');
        const columnNames = columns.map(col => `"${col}"`).join(', ');

        const insertSQL = this.sqlite ?
          // SQLite version with REPLACE
          `REPLACE INTO "${sanitizedTableName}" (airtable_id, ${columnNames}) VALUES (?, ${placeholders})` :
          // PostgreSQL version with ON CONFLICT
          `INSERT INTO "${sanitizedTableName}" (airtable_id, ${columnNames})
           VALUES ($1, ${placeholders})
           ON CONFLICT (airtable_id) DO UPDATE SET
           ${columns.map((col, index) => `"${col}" = $${index + 2}`).join(', ')},
           updated_at = CURRENT_TIMESTAMP`;

        await this.query(insertSQL, [record.id, ...values]);
        insertedCount++;
      } catch (error) {
        console.error(`Error inserting record ${record.id}:`, error.message);
      }
    }

    return insertedCount;
  }

  async query(sql, params = []) {
    if (this.sqlite) {
      return this.querySQLite(sql, params);
    } else if (this.pool) {
      return this.pool.query(sql, params);
    } else {
      throw new Error('Database not connected');
    }
  }

  async querySQLite(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        this.sqlite.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve({ rows });
        });
      } else {
        this.sqlite.run(sql, params, function(err) {
          if (err) reject(err);
          else resolve({ rowCount: this.changes });
        });
      }
    });
  }
}

module.exports = DatabaseService;