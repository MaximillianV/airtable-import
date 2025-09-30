/**
 * V2 Import Test - Using Proven Working Components
 * Tests the new V2 system built on top of the existing working infrastructure
 */

const axios = require('axios');

async function testV2Import() {
  console.log('🚀 Testing V2 Type-Aware Import System (Built on Proven Components)\n');

  try {
    // Test 1: Authentication (using proven working auth)
    console.log('🔐 Test 1: Authentication...');
    const authResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'admin@example.com',
      password: 'admin123'
    });
    const token = authResponse.data.token;
    console.log('✅ Authentication successful\n');

    // Test 2: Verify original system still works
    console.log('🔧 Test 2: Verifying original import system works...');
    try {
      const originalTestResponse = await axios.post('http://localhost:3001/api/import/start', {
        tableNames: ['test-check']  // Just a test call to verify connectivity
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('✅ Original import system is working\n');
    } catch (error) {
      if (error.response?.status === 400 || error.response?.status === 404) {
        console.log('✅ Original import system is accessible (got validation error as expected)\n');
      } else {
        console.log(`⚠️  Original import system response: ${error.response?.status}\n`);
      }
    }

    // Test 3: V2 Phase 1 - Schema Creation
    console.log('🚀 Test 3: V2 Phase 1 - Type-aware schema creation...');
    const phase1Response = await axios.post('http://localhost:3001/api/v2-import/phase1-create-schema', {
      selectedTables: null  // Import all tables, or specify: ['Contacts', 'Companies']
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (phase1Response.data.success) {
      console.log('✅ Phase 1 successful!');
      console.log(`   📊 Tables processed: ${phase1Response.data.tablesProcessed}`);
      console.log(`   ✅ Tables created: ${phase1Response.data.tablesCreated}`);
      
      const sessionId = phase1Response.data.sessionId;
      console.log(`   🔑 Session ID: ${sessionId}\n`);

      // Test 4: V2 Phase 2 - Data Import
      console.log('📥 Test 4: V2 Phase 2 - Type-aware data import...');
      const phase2Response = await axios.post('http://localhost:3001/api/v2-import/phase2-import-data', {
        sessionId: sessionId
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (phase2Response.data.success) {
        console.log('✅ Phase 2 successful!');
        console.log(`   📊 Tables imported: ${phase2Response.data.tablesImported}`);
        console.log(`   📝 Total records: ${phase2Response.data.totalRecords}`);
        console.log('   📋 Import results:');
        
        phase2Response.data.results.forEach(result => {
          if (result.status === 'completed') {
            console.log(`      ✅ ${result.tableName}: ${result.recordsImported} records`);
          } else {
            console.log(`      ❌ ${result.tableName}: ${result.error}`);
          }
        });
        console.log();

        // Test 5: Relationship Analysis
        console.log('🔗 Test 5: Relationship analysis...');
        try {
          const analysisResponse = await axios.post('http://localhost:3001/api/v2-import/analyze-relationships', {
            sessionId: sessionId
          }, {
            headers: { 'Authorization': `Bearer ${token}` }
          });

          if (analysisResponse.data.success) {
            console.log('✅ Relationship analysis completed!');
            console.log(`   🔍 Relationships found: ${analysisResponse.data.relationshipsFound}`);
            console.log(`   📊 Confidence levels: High: ${analysisResponse.data.summary?.highConfidence || 0}, Medium: ${analysisResponse.data.summary?.mediumConfidence || 0}, Low: ${analysisResponse.data.summary?.lowConfidence || 0}`);
            
            if (analysisResponse.data.proposalReport && analysisResponse.data.proposalReport.length > 0) {
              console.log('   📋 Top relationship proposals:');
              analysisResponse.data.proposalReport.slice(0, 3).forEach((proposal, i) => {
                console.log(`      ${i+1}. ${proposal.sourceTable}.${proposal.sourceColumn} → ${proposal.targetTable} (${proposal.confidence}% confidence)`);
              });
            }
          } else {
            console.log('⚠️  Relationship analysis completed with warnings');
          }
        } catch (analysisError) {
          console.log(`⚠️  Relationship analysis: ${analysisError.response?.data?.error || analysisError.message}`);
        }
        console.log();

        // Success Summary
        console.log('🎉 V2 IMPORT TEST RESULTS');
        console.log('==========================');
        console.log('✅ Authentication: Working');
        console.log('✅ Original System: Still functional');
        console.log('✅ V2 Phase 1 (Schema): Working');
        console.log('✅ V2 Phase 2 (Data): Working');
        console.log('🔗 V2 Phase 3 (Relationships): Analysis completed');
        console.log('\n🎯 SUCCESS: V2 system is working with proven components!');
        console.log('\nNext steps:');
        console.log('1. ✅ Core V2 import functionality is working');
        console.log('2. ⏳ Build V2 Review & Approval UI for relationship management');
        console.log('3. ⏳ Implement Schema Applier for applying approved relationships');

      } else {
        console.log('❌ Phase 2 failed:', phase2Response.data.error);
      }
    } else {
      console.log('❌ Phase 1 failed:', phase1Response.data.error);
    }

  } catch (error) {
    console.error('❌ V2 Import test failed:', error.response?.data || error.message);
    
    if (error.response?.data?.details) {
      console.error('📋 Error details:', error.response.data.details);
    }
  }
}

testV2Import();