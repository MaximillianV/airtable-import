#!/usr/bin/env node

/**
 * Test script for V2 Type-Aware Import System
 * 
 * Tests the complete new import workflow:
 * 1. Phase 1: Create type-aware schema
 * 2. Phase 2: Import data with proper transformations
 * 3. Analyze relationships with smart detection
 * 4. Display relationship proposal report
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
let analysisId = '';

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
 * Phase 1: Test type-aware schema creation
 */
async function testPhase1() {
  console.log('\n🚀 Phase 1: Testing type-aware schema creation...');
  
  try {
    const result = await apiCall('POST', '/v2-import/phase1-create-schema');
    
    console.log('✅ Phase 1 completed successfully');
    console.log(`   Session ID: ${result.sessionId}`);
    console.log(`   Phase: ${result.phase}`);
    console.log(`   Message: ${result.message}`);
    
    console.log('\n📊 Schema Summary:');
    console.log(`   Total tables: ${result.data.summary.totalTables}`);
    console.log(`   Total fields: ${result.data.summary.totalFields}`);
    console.log(`   Link fields: ${result.data.summary.linkFields}`);
    console.log(`   Select fields: ${result.data.summary.selectFields}`);
    console.log(`   Computed fields: ${result.data.summary.computedFields}`);
    
    if (result.data.fieldTypeDistribution) {
      console.log('\n🎯 Field Type Distribution:');
      Object.entries(result.data.fieldTypeDistribution)
        .sort(([,a], [,b]) => b - a)
        .forEach(([type, count]) => {
          console.log(`   ${type}: ${count}`);
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
 * Phase 2: Test data import with type transformations
 */
async function testPhase2() {
  console.log('\n📥 Phase 2: Testing data import with type transformations...');
  
  try {
    const result = await apiCall('POST', '/v2-import/phase2-import-data', {
      sessionId
    });
    
    console.log('✅ Phase 2 completed successfully');
    console.log(`   Phase: ${result.phase}`);
    console.log(`   Message: ${result.message}`);
    
    console.log('\n📊 Import Summary:');
    console.log(`   Total records imported: ${result.data.summary.totalRecords}`);
    console.log(`   Successful tables: ${result.data.summary.successfulTables}`);
    console.log(`   Failed tables: ${result.data.summary.failedTables}`);
    
    if (result.data.summary.tableBreakdown && result.data.summary.tableBreakdown.length > 0) {
      console.log('\n📋 Table Breakdown:');
      result.data.summary.tableBreakdown
        .sort((a, b) => b.recordsImported - a.recordsImported)
        .slice(0, 10) // Show top 10 tables
        .forEach(table => {
          const status = table.success ? '✅' : '❌';
          console.log(`   ${status} ${table.table}: ${table.recordsImported} records`);
        });
      
      if (result.data.summary.tableBreakdown.length > 10) {
        console.log(`   ... and ${result.data.summary.tableBreakdown.length - 10} more tables`);
      }
    }
    
    if (result.data.importResults.errors && result.data.importResults.errors.length > 0) {
      console.log('\n❌ Import Errors:');
      result.data.importResults.errors.forEach(error => {
        console.log(`   ${error.table}: ${error.error}`);
      });
    }
    
    return true;
  } catch (error) {
    console.error('❌ Phase 2 failed');
    return false;
  }
}

/**
 * Test relationship analysis
 */
async function testRelationshipAnalysis() {
  console.log('\n🔍 Testing relationship analysis...');
  
  try {
    const result = await apiCall('POST', '/v2-import/analyze-relationships', {
      sessionId
    });
    
    console.log('✅ Relationship analysis completed successfully');
    console.log(`   Phase: ${result.phase}`);
    console.log(`   Message: ${result.message}`);
    console.log(`   Analysis ID: ${result.data.analysisId}`);
    
    console.log('\n📊 Analysis Summary:');
    console.log(`   Relationships detected: ${result.data.summary.relationshipsDetected}`);
    console.log(`   One-to-One: ${result.data.summary.oneToOne}`);
    console.log(`   One-to-Many: ${result.data.summary.oneToMany}`);
    console.log(`   Many-to-Many: ${result.data.summary.manyToMany}`);
    console.log(`   Review required: ${result.data.reviewRequired}`);
    
    console.log('\n🎯 Confidence Breakdown:');
    console.log(`   High confidence (≥80%): ${result.data.confidenceBreakdown.high}`);
    console.log(`   Medium confidence (60-79%): ${result.data.confidenceBreakdown.medium}`);
    console.log(`   Low confidence (<60%): ${result.data.confidenceBreakdown.low}`);
    
    if (result.data.relationships && result.data.relationships.length > 0) {
      console.log('\n🔗 Detected Relationships:');
      result.data.relationships
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 10) // Show top 10 relationships
        .forEach((rel, index) => {
          const confidencePercent = (rel.confidence * 100).toFixed(1);
          const reviewFlag = rel.reviewRequired ? '⚠️' : '✅';
          console.log(`   ${index + 1}. ${reviewFlag} ${rel.sourceTable}.${rel.sourceField} → ${rel.targetTable} (${confidencePercent}%)`);
          console.log(`      Type: ${rel.detectedType}`);
          console.log(`      Action: ${rel.proposedAction}`);
          console.log(`      Evidence: ${rel.evidence[0]}`); // Show first evidence point
          if (rel.metadata) {
            console.log(`      Data: ${rel.metadata.recordsWithLinks}/${rel.metadata.totalSourceRecords} records with links (max: ${rel.metadata.maxLinksPerRecord})`);
          }
          console.log('');
        });
      
      if (result.data.relationships.length > 10) {
        console.log(`   ... and ${result.data.relationships.length - 10} more relationships`);
      }
    }
    
    analysisId = result.data.analysisId;
    return true;
  } catch (error) {
    console.error('❌ Relationship analysis failed');
    return false;
  }
}

/**
 * Test session status endpoint
 */
async function testSessionStatus() {
  console.log('\n📊 Testing session status...');
  
  try {
    const result = await apiCall('GET', `/v2-import/session/${sessionId}`);
    
    console.log('✅ Session status retrieved successfully');
    console.log(`   Session ID: ${result.sessionId}`);
    console.log(`   Current Phase: ${result.phase}`);
    console.log(`   Created At: ${result.createdAt}`);
    
    console.log('\n📈 Progress:');
    console.log(`   Schema Created: ${result.progress.schemaCreated ? '✅' : '❌'}`);
    console.log(`   Data Imported: ${result.progress.dataImported ? '✅' : '❌'}`);
    console.log(`   Relationships Analyzed: ${result.progress.relationshipsAnalyzed ? '✅' : '❌'}`);
    console.log(`   Completed: ${result.progress.completed ? '✅' : '❌'}`);
    
    if (result.summary) {
      console.log('\n📊 Final Summary:');
      if (result.summary.tables) console.log(`   Tables: ${result.summary.tables}`);
      if (result.summary.fields) console.log(`   Fields: ${result.summary.fields}`);
      if (result.summary.recordsImported) console.log(`   Records Imported: ${result.summary.recordsImported}`);
      if (result.summary.relationshipsDetected) console.log(`   Relationships Detected: ${result.summary.relationshipsDetected}`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Session status failed');
    return false;
  }
}

/**
 * Test analysis retrieval endpoint
 */
async function testAnalysisRetrieval() {
  if (!analysisId) {
    console.log('\n⚠️ Skipping analysis retrieval test (no analysis ID)');
    return true;
  }
  
  console.log('\n📋 Testing analysis retrieval...');
  
  try {
    const result = await apiCall('GET', `/v2-import/analysis/${analysisId}`);
    
    console.log('✅ Analysis retrieved successfully');
    console.log(`   Analysis ID: ${result.analysisId}`);
    console.log(`   Created At: ${result.data.createdAt}`);
    console.log(`   Total Relationships: ${result.data.relationships.length}`);
    
    return true;
  } catch (error) {
    console.error('❌ Analysis retrieval failed');
    return false;
  }
}

/**
 * Main test execution
 */
async function runTests() {
  console.log('🚀 Starting V2 Type-Aware Import System Tests\n');
  
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
  
  const analysisSuccess = await testRelationshipAnalysis();
  if (!analysisSuccess) {
    console.log('❌ Tests aborted due to relationship analysis failure');
    return;
  }
  
  // Test additional endpoints
  await testSessionStatus();
  await testAnalysisRetrieval();
  
  console.log('\n🎉 All V2 import system tests completed successfully!');
  console.log(`📋 Session ID for reference: ${sessionId}`);
  console.log(`🔍 Analysis ID for reference: ${analysisId}`);
  
  console.log('\n💡 Next steps:');
  console.log('   1. Review the relationship proposals in the analysis report');
  console.log('   2. Create the V2 frontend UI for manual approval');
  console.log('   3. Implement the Schema Applier for Phase 3');
  console.log('   4. Test the complete workflow end-to-end');
  console.log(`   5. Use session ID '${sessionId}' to continue testing`);
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Test execution failed:', error.message);
  process.exit(1);
});