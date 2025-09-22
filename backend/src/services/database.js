const { Pool } = require('pg');

class DatabaseService {
  constructor() {
    this.pool = null;
  }

  async connect(connectionString) {
    try {
      this.pool = new Pool({
        connectionString,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });
      
      // Test connection
      await this.pool.query('SELECT NOW()');
      console.log('Database connected successfully');
      return true;
    } catch (error) {
      console.error('Database connection error:', error.message);
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async createTableFromAirtableSchema(tableName, records) {
    if (!this.pool) {
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
      .map(([colName, colType]) => `"${this.sanitizeColumnName(colName)}" ${colType}`)
      .join(', ');

    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS "${sanitizedTableName}" (
        id SERIAL PRIMARY KEY,
        airtable_id VARCHAR(255) UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ${columnDefinitions}
      )
    `;

    try {
      await this.pool.query(createTableSQL);
      console.log(`Table ${sanitizedTableName} created successfully`);
      return sanitizedTableName;
    } catch (error) {
      console.error(`Error creating table ${sanitizedTableName}:`, error.message);
      throw error;
    }
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
    if (!this.pool || !records || records.length === 0) {
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

        const placeholders = values.map((_, index) => `$${index + 2}`).join(', ');
        const columnNames = columns.map(col => `"${col}"`).join(', ');

        const insertSQL = `
          INSERT INTO "${sanitizedTableName}" (airtable_id, ${columnNames})
          VALUES ($1, ${placeholders})
          ON CONFLICT (airtable_id) DO UPDATE SET
          ${columns.map((col, index) => `"${col}" = $${index + 2}`).join(', ')},
          updated_at = CURRENT_TIMESTAMP
        `;

        await this.pool.query(insertSQL, [record.id, ...values]);
        insertedCount++;
      } catch (error) {
        console.error(`Error inserting record ${record.id}:`, error.message);
      }
    }

    return insertedCount;
  }

  async query(sql, params = []) {
    if (!this.pool) {
      throw new Error('Database not connected');
    }
    return this.pool.query(sql, params);
  }
}

module.exports = DatabaseService;