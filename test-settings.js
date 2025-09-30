/**
 * Quick test script to check user settings
 */

const axios = require('axios');

async function testSettings() {
  try {
    console.log('🔐 Testing settings API...');
    
    // First authenticate
    const authResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'admin@example.com',
      password: 'admin123'
    });
    
    const token = authResponse.data.token;
    console.log('✅ Authentication successful');
    
    // Get current settings
    const settingsResponse = await axios.get('http://localhost:3001/api/settings', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('📋 Current settings:');
    console.log(JSON.stringify(settingsResponse.data, null, 2));
    
  } catch (error) {
    console.error('❌ Settings test failed:', error.response?.data || error.message);
  }
}

testSettings();