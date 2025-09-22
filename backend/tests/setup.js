// Test setup file
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing';
process.env.DATABASE_URL = 'sqlite::memory:';

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