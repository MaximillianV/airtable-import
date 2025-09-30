#!/usr/bin/env node

/**
 * Test script for staged workflow API endpoints
 * Tests each stage of the import workflow separately for debugging
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

// Test credentials (should match those in your database)
const TEST_CREDENTIALS = {
  email: 'admin@example.com',
  password: 'admin123'
};

let authToken = '';
let currentSessionId = '';

/**
 * Authenticate and get token
 */
async function authenticate() {
  try {
    console.log('🔐 Authenticating...');
    const response = await axios.post(`${BASE_URL}/auth/login`, TEST_CREDENTIALS);
    authToken = response.data.token;
    console.log('✅ Authentication successful');
    return true;
  } catch (error) {
    console.error('❌ Authentication failed:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Get axios config with auth header
 */
function getAxiosConfig() {
  return {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  };
}

/**
 * Test Stage 1: Connect to services
 */
async function testStage1Connect() {
  try {
    console.log('\n🔗 Stage 1: Testing connection...');
    const response = await axios.post(
      `${BASE_URL}/staged-workflow/connect`,
      {},
      getAxiosConfig()
    );
    
    currentSessionId = response.data.sessionId;
    console.log('✅ Stage 1 successful:', response.data.message);
    console.log('📋 Session ID:', currentSessionId);
    console.log('📊 Data:', response.data.data);
    return true;
  } catch (error) {
    console.error('❌ Stage 1 failed:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Test Stage 2: Discover schema
 */
async function testStage2DiscoverSchema() {
  try {
    console.log('\n🔍 Stage 2: Testing schema discovery...');
    const response = await axios.post(
      `${BASE_URL}/staged-workflow/discover-schema`,
      { sessionId: currentSessionId },
      getAxiosConfig()
    );
    
    console.log('✅ Stage 2 successful:', response.data.message);
    console.log('📊 Tables found:', response.data.data.tablesFound);
    console.log('📋 Tables:', response.data.data.tables.map(t => `${t.name} (${t.fieldCount} fields, ${t.recordCount} records)`));
    return true;
  } catch (error) {
    console.error('❌ Stage 2 failed:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Test Stage 3: Create database structure
 */
async function testStage3CreateStructure() {
  try {
    console.log('\n🏗️ Stage 3: Testing database structure creation...');
    const response = await axios.post(
      `${BASE_URL}/staged-workflow/create-structure`,
      { sessionId: currentSessionId },
      getAxiosConfig()
    );
    
    console.log('✅ Stage 3 successful:', response.data.message);
    console.log('📊 Tables created:', response.data.data.tablesCreated);
    console.log('📊 ENUMs created:', response.data.data.enumsCreated);
    return true;
  } catch (error) {
    console.error('❌ Stage 3 failed:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Test Stage 4: Import data
 */
async function testStage4ImportData() {
  try {
    console.log('\n📥 Stage 4: Testing data import...');
    console.log('⏳ This may take a while for large datasets...');
    
    const response = await axios.post(
      `${BASE_URL}/staged-workflow/import-data`,
      { sessionId: currentSessionId },
      getAxiosConfig()
    );
    
    console.log('✅ Stage 4 successful:', response.data.message);
    console.log('📊 Total records imported:', response.data.data.totalRecords);
    console.log('📊 Tables imported:', response.data.data.importedTables);
    console.log('📊 Average records/second:', response.data.data.avgRecordsPerSecond);
    return true;
  } catch (error) {
    console.error('❌ Stage 4 failed:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Get session status
 */
async function getSessionStatus() {
  try {
    console.log('\n📊 Getting session status...');
    const response = await axios.get(
      `${BASE_URL}/staged-workflow/status/${currentSessionId}`,
      getAxiosConfig()
    );
    
    console.log('✅ Session status:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Status check failed:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('🧪 Starting Staged Workflow API Tests');
  console.log('=====================================');
  
  // Authenticate
  if (!await authenticate()) {
    process.exit(1);
  }
  
  // Test stages sequentially
  const stages = [
    { name: 'Connect', test: testStage1Connect },
    { name: 'Discover Schema', test: testStage2DiscoverSchema },
    { name: 'Create Structure', test: testStage3CreateStructure },
    { name: 'Import Data', test: testStage4ImportData }
  ];
  
  for (const stage of stages) {
    if (!await stage.test()) {
      console.log(`\n❌ Test suite stopped at stage: ${stage.name}`);
      await getSessionStatus();
      process.exit(1);
    }
  }
  
  // Get final status
  await getSessionStatus();
  
  console.log('\n🎉 All tests completed successfully!');
  console.log('=====================================');
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: node test-staged-workflow.js [options]

Options:
  --help, -h     Show this help message
  
This script tests the staged workflow API endpoints in sequence:
1. Connect to Airtable and database
2. Discover Airtable schema  
3. Create database structure
4. Import data

Make sure the backend server is running on localhost:3001
and you have valid settings configured.
`);
  process.exit(0);
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Test runner failed:', error.message);
  process.exit(1);
});