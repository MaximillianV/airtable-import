// Test setup file
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing';

// Use PostgreSQL for tests (same as CI/CD pipeline)
// If local PostgreSQL is not available, fall back to a test database
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/airtable_import_test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.REDIS_ENABLED = 'false'; // Disable Redis for unit tests to avoid dependencies

// Mock console.log during tests to reduce noise
const originalConsoleLog = console.log;
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
};

// Restore console.log for specific test debugging if needed
global.restoreConsole = () => {
  console.log = originalConsoleLog;
};

// Common test utilities
global.createMockAirtableRecord = (id, fields) => ({
  id: id || 'recTestRecord123',
  fields: fields || {
    'Name': 'Test Record',
    'Status': 'Active',
    'Count': 42
  }
});

global.createMockAirtableRecords = (count = 3) => {
  return Array.from({ length: count }, (_, i) => 
    createMockAirtableRecord(`recTest${i + 1}`, {
      'Name': `Test Record ${i + 1}`,
      'Status': i % 2 === 0 ? 'Active' : 'Inactive',
      'Count': (i + 1) * 10
    })
  );
};