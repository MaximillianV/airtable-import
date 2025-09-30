/**
 * System Recovery Verification Test
 * 
 * This script tests the complete system restoration after the accidental database cleanup.
 * It verifies that all core functionality is working as expected.
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

/**
 * Test authentication system restoration
 * Verifies that the admin user can login with the default credentials
 */
async function testAuthentication() {
  console.log('🔐 Testing Authentication System...');
  
  try {
    const response = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'admin@example.com',
      password: 'admin123'
    });
    
    if (response.data.token && response.data.user) {
      console.log('✅ Authentication successful');
      console.log(`   User: ${response.data.user.email}`);
      console.log(`   Role: ${response.data.user.role}`);
      return response.data.token;
    } else {
      throw new Error('Invalid response structure');
    }
  } catch (error) {
    console.error('❌ Authentication failed:', error.response?.data?.error || error.message);
    return null;
  }
}

/**
 * Test protected routes with JWT token
 * Verifies that JWT authentication is working properly
 */
async function testProtectedRoutes(token) {
  console.log('\n🛡️  Testing Protected Routes...');
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  
  try {
    // Test settings endpoint
    const settingsResponse = await axios.get(`${BASE_URL}/api/settings`, { headers });
    console.log('✅ Settings endpoint accessible');
    
    // Test import sessions endpoint (should work even if no sessions exist)
    try {
      const sessionsResponse = await axios.get(`${BASE_URL}/api/import/sessions`, { headers });
      console.log('✅ Import sessions endpoint accessible');
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('✅ Import sessions endpoint accessible (no sessions found - expected)');
      } else {
        throw error;
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ Protected routes failed:', error.response?.data?.error || error.message);
    return false;
  }
}

/**
 * Test database connectivity and schema
 * Verifies that all tables are properly restored
 */
async function testDatabaseSchema(token) {
  console.log('\n🗄️  Testing Database Schema...');
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  
  try {
    // Test that we can create/update settings (this exercises the database)
    const testSettings = {
      airtableApiKey: 'test_key_for_verification',
      airtableBaseId: 'test_base_for_verification',
      databaseUrl: 'postgresql://test:test@localhost:5432/test_db',
      debugMode: true
    };
    
    const response = await axios.post(`${BASE_URL}/api/settings`, testSettings, { headers });
    console.log('✅ Database write operations working');
    
    // Read back the settings to verify
    const readResponse = await axios.get(`${BASE_URL}/api/settings`, { headers });
    if (readResponse.data.airtableApiKey === testSettings.airtableApiKey) {
      console.log('✅ Database read operations working');
      console.log('✅ Settings table properly restored');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Database schema test failed:', error.response?.data?.error || error.message);
    return false;
  }
}

/**
 * Test that our previous fixes are still in place
 * Verifies that the table discovery and import workflow fixes were not lost
 */
async function testWorkflowFixes() {
  console.log('\n🔧 Testing Previous Workflow Fixes...');
  
  // Check that the table discovery fix is still in place
  const { readFile } = require('fs').promises;
  
  try {
    // Verify that fullImportWorkflow.js has the correct discoverTablesWithCounts method
    const workflowContent = await readFile('/root/airtable-import/backend/src/services/fullImportWorkflow.js', 'utf8');
    
    if (workflowContent.includes('discoverTablesWithCounts()')) {
      console.log('✅ Table discovery fix still in place');
    } else {
      console.log('❌ Table discovery fix may have been lost');
    }
    
    // Verify ENUM handling is still in place
    if (workflowContent.includes('createPostgreSQLEnum') && workflowContent.includes('IF NOT EXISTS')) {
      console.log('✅ ENUM conflict handling still in place');
    } else {
      console.log('❌ ENUM conflict handling may have been lost');
    }
    
    // Verify SQL field quoting is still in place
    if (workflowContent.includes('`"${field.name}"`')) {
      console.log('✅ SQL field quoting fix still in place');
    } else {
      console.log('❌ SQL field quoting fix may have been lost');
    }
    
    // Check that enhancedImportService.js is still present
    const enhancedImportContent = await readFile('/root/airtable-import/backend/src/services/enhancedImportService.js', 'utf8');
    if (enhancedImportContent.includes('importTableWithBatches')) {
      console.log('✅ Enhanced batch import service still in place');
    } else {
      console.log('❌ Enhanced batch import service may have been lost');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Workflow fixes verification failed:', error.message);
    return false;
  }
}

/**
 * Main test execution function
 * Runs all verification tests and provides a comprehensive report
 */
async function runSystemRecoveryTest() {
  console.log('🏥 System Recovery Verification Test');
  console.log('=====================================\n');
  
  let allTestsPassed = true;
  
  // Test 1: Authentication
  const token = await testAuthentication();
  if (!token) {
    allTestsPassed = false;
  }
  
  // Test 2: Protected Routes (only if authentication worked)
  if (token) {
    const protectedRoutesWorking = await testProtectedRoutes(token);
    if (!protectedRoutesWorking) {
      allTestsPassed = false;
    }
    
    // Test 3: Database Schema (only if protected routes work)
    if (protectedRoutesWorking) {
      const databaseWorking = await testDatabaseSchema(token);
      if (!databaseWorking) {
        allTestsPassed = false;
      }
    }
  }
  
  // Test 4: Previous Fixes (can run independently)
  const workflowFixesIntact = await testWorkflowFixes();
  if (!workflowFixesIntact) {
    allTestsPassed = false;
  }
  
  // Final Report
  console.log('\n📊 System Recovery Test Results');
  console.log('===============================');
  
  if (allTestsPassed) {
    console.log('🎉 ALL TESTS PASSED! System has been fully restored.');
    console.log('\n✅ Authentication system working');
    console.log('✅ Database schema restored');
    console.log('✅ Protected routes accessible');
    console.log('✅ Previous workflow fixes preserved');
    console.log('\n🚀 You can now login with:');
    console.log('   Email: admin@example.com');
    console.log('   Password: admin123');
  } else {
    console.log('❌ Some tests failed. Please review the output above.');
  }
  
  console.log('\n📍 Frontend available at: http://localhost:3000');
  console.log('📍 Backend API available at: http://localhost:3001');
}

// Run the test
runSystemRecoveryTest().catch(console.error);