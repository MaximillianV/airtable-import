#!/usr/bin/env node

/**
 * Test script for Modular Relationship Analysis API
 * 
 * Tests all 4 phases of relationship analysis:
 * 1. Confidence Level Analysis
 * 2. Junction Table Detection  
 * 3. Junction Table Creation
 * 4. Foreign Key Creation
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

// Test credentials
const testCredentials = {
  email: 'admin@example.com',
  password: 'admin123'
};

let authToken = '';
let sessionId = '';

/**
 * Helper function to make authenticated API calls
 */
async function apiCall(method, endpoint, data = null) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`❌ API call failed: ${method} ${endpoint}`);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.error(`   Error: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Test authentication and get JWT token
 */
async function authenticate() {
  console.log('🔐 Authenticating...');
  
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, testCredentials);
    authToken = response.data.token;
    console.log('✅ Authentication successful');
    return true;
  } catch (error) {
    console.error('❌ Authentication failed:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Phase 1: Test confidence level analysis
 */
async function testPhase1() {
  console.log('\n🔍 Phase 1: Testing confidence level analysis...');
  
  try {
    const result = await apiCall('POST', '/modular-analysis/phase1-confidence-analysis');
    
    console.log('✅ Phase 1 completed successfully');
    console.log(`   Session ID: ${result.sessionId}`);
    console.log(`   Phase: ${result.phase}`);
    console.log(`   Message: ${result.message}`);
    console.log('\n📊 Statistics:');
    console.log(`   Total tables: ${result.data.statistics.totalTables}`);
    console.log(`   Total records: ${result.data.statistics.totalRecords}`);
    console.log(`   Potential relationships: ${result.data.statistics.potentialRelationships}`);
    console.log('\n🎯 Confidence Distribution:');
    console.log(`   High confidence (≥0.8): ${result.data.confidenceDistribution['high (≥0.8)']}`);
    console.log(`   Medium confidence (0.6-0.79): ${result.data.confidenceDistribution['medium (0.6-0.79)']}`);
    console.log(`   Low confidence (0.3-0.59): ${result.data.confidenceDistribution['low (0.3-0.59)']}`);
    
    if (result.data.topRelationships && result.data.topRelationships.length > 0) {
      console.log('\n🔝 Top 5 Relationships:');
      result.data.topRelationships.slice(0, 5).forEach((rel, index) => {
        console.log(`   ${index + 1}. ${rel.fromTable}.${rel.fromField} → ${rel.toTable}.${rel.toField} (${(rel.confidence * 100).toFixed(1)}%)`);
        console.log(`      ${rel.reasoning}`);
      });
    }
    
    sessionId = result.sessionId;
    return true;
  } catch (error) {
    console.error('❌ Phase 1 failed');
    return false;
  }
}

/**
 * Phase 2: Test junction table detection
 */
async function testPhase2() {
  console.log('\n🔍 Phase 2: Testing junction table detection...');
  
  try {
    const result = await apiCall('POST', '/modular-analysis/phase2-junction-detection', {
      sessionId
    });
    
    console.log('✅ Phase 2 completed successfully');
    console.log(`   Phase: ${result.phase}`);
    console.log(`   Message: ${result.message}`);
    console.log('\n📊 Results:');
    console.log(`   Junction tables needed: ${result.data.junctionTablesNeeded}`);
    console.log(`   Direct relationships: ${result.data.directRelationships}`);
    
    if (result.data.junctionTablePlans && result.data.junctionTablePlans.length > 0) {
      console.log('\n🔗 Junction Table Plans:');
      result.data.junctionTablePlans.forEach((plan, index) => {
        console.log(`   ${index + 1}. ${plan.junctionTableName} (${plan.fromTable} ↔ ${plan.toTable}) - ${(plan.confidence * 100).toFixed(1)}%`);
      });
    }
    
    if (result.data.directRelationshipPlans && result.data.directRelationshipPlans.length > 0) {
      console.log('\n➡️ Direct Relationship Plans (top 5):');
      result.data.directRelationshipPlans.forEach((plan, index) => {
        console.log(`   ${index + 1}. ${plan.fromTable}.${plan.fromField} → ${plan.toTable}.${plan.toField} - ${(plan.confidence * 100).toFixed(1)}%`);
      });
    }
    
    return true;
  } catch (error) {
    console.error('❌ Phase 2 failed');
    return false;
  }
}

/**
 * Phase 3: Test junction table creation
 */
async function testPhase3() {
  console.log('\n🏗️ Phase 3: Testing junction table creation...');
  
  try {
    const result = await apiCall('POST', '/modular-analysis/phase3-create-junction-tables', {
      sessionId
    });
    
    console.log('✅ Phase 3 completed successfully');
    console.log(`   Phase: ${result.phase}`);
    console.log(`   Message: ${result.message}`);
    console.log('\n📊 Summary:');
    console.log(`   Successful: ${result.data.summary.successful}`);
    console.log(`   Failed: ${result.data.summary.failed}`);
    console.log(`   Total: ${result.data.summary.total}`);
    
    if (result.data.createdJunctionTables && result.data.createdJunctionTables.length > 0) {
      console.log('\n🏗️ Created Junction Tables:');
      result.data.createdJunctionTables.forEach((table, index) => {
        console.log(`   ${index + 1}. ${table.tableName} (${table.fromTable} ↔ ${table.toTable}) - ${(table.confidence * 100).toFixed(1)}%`);
      });
    }
    
    if (result.data.errors && result.data.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.data.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.junctionTableName}: ${error.error}`);
      });
    }
    
    return true;
  } catch (error) {
    console.error('❌ Phase 3 failed');
    return false;
  }
}

/**
 * Phase 4: Test foreign key creation
 */
async function testPhase4() {
  console.log('\n🔗 Phase 4: Testing foreign key creation...');
  
  try {
    const result = await apiCall('POST', '/modular-analysis/phase4-create-foreign-keys', {
      sessionId
    });
    
    console.log('✅ Phase 4 completed successfully');
    console.log(`   Phase: ${result.phase}`);
    console.log(`   Message: ${result.message}`);
    console.log('\n📊 Summary:');
    console.log(`   Successful: ${result.data.summary.successful}`);
    console.log(`   Failed: ${result.data.summary.failed}`);
    console.log(`   Direct relationships: ${result.data.summary.directRelationships}`);
    console.log(`   Junction table relationships: ${result.data.summary.junctionTableRelationships}`);
    
    if (result.data.createdForeignKeys && result.data.createdForeignKeys.length > 0) {
      console.log('\n🔗 Created Foreign Keys:');
      result.data.createdForeignKeys.slice(0, 10).forEach((fk, index) => {
        const type = fk.type === 'junction_table_fk' ? '[Junction]' : '[Direct]';
        console.log(`   ${index + 1}. ${type} ${fk.constraintName}: ${fk.fromTable}.${fk.fromField} → ${fk.toTable}.${fk.toField}`);
      });
      
      if (result.data.createdForeignKeys.length > 10) {
        console.log(`   ... and ${result.data.createdForeignKeys.length - 10} more`);
      }
    }
    
    if (result.data.errors && result.data.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.data.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.relationship || error.junctionTable}: ${error.error}`);
      });
    }
    
    return true;
  } catch (error) {
    console.error('❌ Phase 4 failed');
    return false;
  }
}

/**
 * Test session status endpoint
 */
async function testSessionStatus() {
  console.log('\n📊 Testing session status...');
  
  try {
    const result = await apiCall('GET', `/modular-analysis/session/${sessionId}`);
    
    console.log('✅ Session status retrieved successfully');
    console.log(`   Session ID: ${result.sessionId}`);
    console.log(`   Current Phase: ${result.phase}`);
    console.log(`   Created At: ${result.createdAt}`);
    console.log('\n📈 Progress:');
    console.log(`   Phase 1 Complete: ${result.progress.phase1Complete ? '✅' : '❌'}`);
    console.log(`   Phase 2 Complete: ${result.progress.phase2Complete ? '✅' : '❌'}`);
    console.log(`   Phase 3 Complete: ${result.progress.phase3Complete ? '✅' : '❌'}`);
    console.log(`   Phase 4 Complete: ${result.progress.phase4Complete ? '✅' : '❌'}`);
    
    if (result.statistics) {
      console.log('\n📊 Final Statistics:');
      console.log(`   Total Tables: ${result.statistics.totalTables}`);
      console.log(`   Total Records: ${result.statistics.totalRecords}`);
      console.log(`   Potential Relationships: ${result.statistics.potentialRelationships}`);
      console.log(`   High Confidence: ${result.statistics.highConfidence}`);
      console.log(`   Medium Confidence: ${result.statistics.mediumConfidence}`);
      console.log(`   Low Confidence: ${result.statistics.lowConfidence}`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Session status failed');
    return false;
  }
}

/**
 * Main test execution
 */
async function runTests() {
  console.log('🚀 Starting Modular Relationship Analysis Tests\n');
  
  // Authenticate
  const authSuccess = await authenticate();
  if (!authSuccess) {
    console.log('❌ Tests aborted due to authentication failure');
    return;
  }
  
  // Run all phases in sequence
  const phase1Success = await testPhase1();
  if (!phase1Success) {
    console.log('❌ Tests aborted due to Phase 1 failure');
    return;
  }
  
  const phase2Success = await testPhase2();
  if (!phase2Success) {
    console.log('❌ Tests aborted due to Phase 2 failure');
    return;
  }
  
  const phase3Success = await testPhase3();
  if (!phase3Success) {
    console.log('❌ Tests aborted due to Phase 3 failure');
    return;
  }
  
  const phase4Success = await testPhase4();
  if (!phase4Success) {
    console.log('❌ Tests aborted due to Phase 4 failure');
    return;
  }
  
  // Check final session status
  await testSessionStatus();
  
  console.log('\n🎉 All modular relationship analysis tests completed successfully!');
  console.log(`📋 Session ID for reference: ${sessionId}`);
  
  console.log('\n💡 Next steps:');
  console.log('   1. Check your PostgreSQL database for new junction tables');
  console.log('   2. Verify foreign key constraints have been created');
  console.log('   3. Test the relationships with some queries');
  console.log(`   4. Use session ID '${sessionId}' to track this analysis session`);
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Test execution failed:', error.message);
  process.exit(1);
});