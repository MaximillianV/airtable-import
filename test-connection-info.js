#!/usr/bin/env node

/**
 * Quick test to check connection information display
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

async function testConnection() {
  try {
    // Login
    console.log('🔐 Logging in...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@example.com',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login successful');
    
    // Test connection endpoint
    console.log('\n🔗 Testing connection endpoint...');
    const connectResponse = await axios.post(
      `${BASE_URL}/staged-workflow/connect`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Connection successful!');
    console.log('📊 Connection Data:');
    console.log('   Session ID:', connectResponse.data.sessionId);
    console.log('   Airtable Base ID:', connectResponse.data.data.airtableBaseId);
    console.log('   Import DB Location:', connectResponse.data.data.importDbLocation);
    console.log('   Import DB Type:', connectResponse.data.data.importDbType);
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testConnection();