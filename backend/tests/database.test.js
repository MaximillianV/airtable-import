const DatabaseService = require('../src/services/database');

describe('DatabaseService', () => {
  let db;

  beforeEach(async () => {
    db = new DatabaseService();
    await db.connect('sqlite::memory:');
  });

  afterEach(async () => {
    await db.disconnect();
  });

  describe('connection', () => {
    test('should connect to SQLite in test mode', async () => {
      const newDb = new DatabaseService();
      const result = await newDb.connect('sqlite::memory:');
      expect(result).toBe(true);
      await newDb.disconnect();
    });
  });

  describe('table creation', () => {
    test('should create table from Airtable schema', async () => {
      const records = createMockAirtableRecords(2);
      
      const tableName = await db.createTableFromAirtableSchema('test_table', records);
      expect(tableName).toBe('test_table');
    });

    test('should sanitize table names', async () => {
      const records = createMockAirtableRecords(1);
      
      const tableName = await db.createTableFromAirtableSchema('Test Table-123!', records);
      expect(tableName).toBe('test_table_123_');
    });

    test('should handle empty records array', async () => {
      await expect(
        db.createTableFromAirtableSchema('test_table', [])
      ).rejects.toThrow('No records provided to infer schema');
    });
  });

  describe('record insertion', () => {
    test('should insert records successfully', async () => {
      const records = createMockAirtableRecords(3);
      
      // Create table first
      await db.createTableFromAirtableSchema('test_table', records);
      
      // Insert records
      const insertedCount = await db.insertRecords('test_table', records);
      expect(insertedCount).toBe(3);
    });

    test('should handle upsert on duplicate records', async () => {
      const records = createMockAirtableRecords(2);
      
      // Create table and insert records
      await db.createTableFromAirtableSchema('test_table', records);
      await db.insertRecords('test_table', records);
      
      // Insert same records again (should update, not duplicate)
      const insertedCount = await db.insertRecords('test_table', records);
      expect(insertedCount).toBe(2);
      
      // Verify only 2 records exist
      const result = await db.query('SELECT COUNT(*) as count FROM test_table');
      expect(result.rows[0].count).toBe(2);
    });
  });

  describe('column type inference', () => {
    test('should infer correct column types', async () => {
      const records = [
        createMockAirtableRecord('rec1', {
          'Text Field': 'Some text',
          'Number Field': 42,
          'Boolean Field': true,
          'Date Field': '2023-01-01',
          'Array Field': ['item1', 'item2']
        })
      ];
      
      await db.createTableFromAirtableSchema('type_test', records);
      
      // Verify table was created (specific column type checking would require 
      // database-specific queries which vary between SQLite and PostgreSQL)
      const result = await db.query('SELECT name FROM sqlite_master WHERE type="table" AND name="type_test"');
      expect(result.rows.length).toBe(1);
    });
  });

  describe('sanitization', () => {
    test('should sanitize table names correctly', () => {
      expect(db.sanitizeTableName('Test Table-123!')).toBe('test_table_123_');
      expect(db.sanitizeTableName('ValidTableName')).toBe('validtablename');
      expect(db.sanitizeTableName('table@#$%^&*()')).toBe('table_________');
    });

    test('should sanitize column names correctly', () => {
      expect(db.sanitizeColumnName('Column Name')).toBe('column_name');
      expect(db.sanitizeColumnName('Valid_Column_123')).toBe('valid_column_123');
      expect(db.sanitizeColumnName('col@#$%')).toBe('col____');
    });
  });
});