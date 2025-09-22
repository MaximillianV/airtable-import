import { test, expect } from '@playwright/test';

test.describe('API Integration Tests', () => {
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    // Get authentication token for API tests
    const response = await request.post('http://localhost:3001/api/auth/login', {
      data: {
        email: 'admin@example.com',
        password: 'admin123'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    authToken = data.token;
    expect(authToken).toBeTruthy();
  });

  test('should be able to get user settings', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api/settings', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const settings = await response.json();
    
    // Should return sanitized settings object
    expect(settings).toHaveProperty('airtableBaseId');
    expect(settings).toHaveProperty('databaseUrl');
    expect(settings).toHaveProperty('airtableApiKey');
  });

  test('should be able to save user settings', async ({ request }) => {
    const testSettings = {
      airtableApiKey: 'test-api-key',
      airtableBaseId: 'test-base-id',
      databaseUrl: 'postgresql://localhost:5432/test'
    };
    
    const response = await request.post('http://localhost:3001/api/settings', {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: testSettings
    });
    
    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    expect(result).toHaveProperty('message', 'Settings saved successfully');
    expect(result).toHaveProperty('timestamp');
  });

  test('should be able to test connections with settings', async ({ request }) => {
    const testData = {
      airtableApiKey: 'test-api-key',
      airtableBaseId: 'test-base-id',
      databaseUrl: 'sqlite::memory:'
    };
    
    const response = await request.post('http://localhost:3001/api/settings/test', {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: testData
    });
    
    // This will likely fail due to invalid credentials, but we're testing the endpoint structure
    // A 400/401 error is expected and acceptable for this test
    expect([200, 400, 401, 500]).toContain(response.status());
    
    if (response.ok()) {
      const result = await response.json();
      expect(result).toBeDefined();
    } else {
      const error = await response.json();
      expect(error).toHaveProperty('error');
    }
  });

  test('should require authentication for protected endpoints', async ({ request }) => {
    // Test without authorization header
    const response = await request.get('http://localhost:3001/api/settings');
    
    expect(response.status()).toBe(401);
    const error = await response.json();
    expect(error).toHaveProperty('error');
  });

  test('should validate required fields in settings save', async ({ request }) => {
    // Test with missing required fields
    const response = await request.post('http://localhost:3001/api/settings', {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        airtableApiKey: 'test-key'
        // Missing airtableBaseId and databaseUrl
      }
    });
    
    expect(response.status()).toBe(400);
    const error = await response.json();
    expect(error).toHaveProperty('error');
  });
});