#!/usr/bin/env node

/**
 * Test script for remaining stages of workflow (5 & 6)
 * Continues from existing session after data import
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

// Test credentials
const TEST_CREDENTIALS = {
  email: 'admin@example.com',
  password: 'admin123'
};

let authToken = '';

// Use the session ID from the previous successful test
const EXISTING_SESSION_ID = 'staged-1758824093093-05o24914g';

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
 * Check session status
 */
async function checkSessionStatus() {
  try {
    console.log(`\n📊 Checking session status for: ${EXISTING_SESSION_ID}`);
    const response = await axios.get(
      `${BASE_URL}/staged-workflow/status/${EXISTING_SESSION_ID}`,
      getAxiosConfig()
    );
    
    console.log('✅ Session found:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Session check failed:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Test Stage 5: Analyze relationships
 */
async function testStage5AnalyzeRelationships() {
  try {
    console.log('\n🧠 Stage 5: Testing relationship analysis...');
    console.log('⏳ This may take a while to analyze relationships across all tables...');
    
    const response = await axios.post(
      `${BASE_URL}/staged-workflow/analyze-relationships`,
      { sessionId: EXISTING_SESSION_ID },
      getAxiosConfig()
    );
    
    console.log('✅ Stage 5 successful:', response.data.message);
    console.log('📊 Relationships found:', response.data.data.relationshipsFound);
    
    // Show some relationship details if available
    if (response.data.data.relationships && response.data.data.relationships.length > 0) {
      console.log('📋 Sample relationships:');
      response.data.data.relationships.slice(0, 5).forEach((rel, idx) => {
        console.log(`   ${idx + 1}. ${rel.fromTable}.${rel.fromField} → ${rel.toTable}.${rel.toField} (${rel.relationshipType})`);
      });
      
      if (response.data.data.relationships.length > 5) {
        console.log(`   ... and ${response.data.data.relationships.length - 5} more relationships`);
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ Stage 5 failed:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Test Stage 6: Apply schema enhancements
 */
async function testStage6ApplyEnhancements() {
  try {
    console.log('\n⚡ Stage 6: Testing schema enhancements...');
    console.log('⏳ Applying foreign keys and constraints...');
    
    const response = await axios.post(
      `${BASE_URL}/staged-workflow/apply-enhancements`,
      { sessionId: EXISTING_SESSION_ID },
      getAxiosConfig()
    );
    
    console.log('✅ Stage 6 successful:', response.data.message);
    console.log('📊 Foreign keys created:', response.data.data.foreignKeysCreated);
    console.log('📊 Junction tables created:', response.data.data.junctionTablesCreated);
    console.log('📊 Constraints added:', response.data.data.constraintsAdded);
    
    return true;
  } catch (error) {
    console.error('❌ Stage 6 failed:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Get final session status
 */
async function getFinalStatus() {
  try {
    console.log('\n📊 Getting final session status...');
    const response = await axios.get(
      `${BASE_URL}/staged-workflow/status/${EXISTING_SESSION_ID}`,
      getAxiosConfig()
    );
    
    console.log('✅ Final session status:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Final status check failed:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Main test runner for remaining stages
 */
async function runRemainingStages() {
  console.log('🧪 Testing Remaining Workflow Stages (5 & 6)');
  console.log('==============================================');
  
  // Authenticate
  if (!await authenticate()) {
    process.exit(1);
  }
  
  // Check if session exists and is at the right stage
  const sessionStatus = await checkSessionStatus();
  if (!sessionStatus) {
    console.log('❌ Cannot find existing session. Please run the full workflow first.');
    process.exit(1);
  }
  
  if (sessionStatus.stage !== 'data-imported') {
    console.log(`⚠️  Session is at stage '${sessionStatus.stage}', expected 'data-imported'`);
    console.log('💡 You may need to run the import stages first or use a different session ID');
  }
  
  // Test remaining stages
  const remainingStages = [
    { name: 'Analyze Relationships', test: testStage5AnalyzeRelationships },
    { name: 'Apply Enhancements', test: testStage6ApplyEnhancements }
  ];
  
  for (const stage of remainingStages) {
    if (!await stage.test()) {
      console.log(`\n❌ Test suite stopped at stage: ${stage.name}`);
      await getFinalStatus();
      process.exit(1);
    }
  }
  
  // Get final status
  await getFinalStatus();
  
  console.log('\n🎉 All remaining stages completed successfully!');
  console.log('==============================================');
  console.log('🚀 Full workflow is now complete with relationship analysis and schema enhancements!');
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: node test-remaining-stages.js [options]

Options:
  --help, -h     Show this help message
  
This script tests the remaining workflow stages (5 & 6):
5. Analyze relationships between imported tables
6. Apply schema enhancements (foreign keys, constraints)

Uses existing session: ${EXISTING_SESSION_ID}
Make sure this session exists and has completed data import.
`);
  process.exit(0);
}

// Run the tests
runRemainingStages().catch(error => {
  console.error('❌ Test runner failed:', error.message);
  process.exit(1);
});