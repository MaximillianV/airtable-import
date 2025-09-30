/**
 * Test the enhanced relationship analysis system with proper authentication
 */

const axios = require('axios');

// Base URL for API calls
const API_BASE = 'http://localhost:3001/api';

/**
 * Test the relationship analysis with proper JWT authentication
 */
async function testRelationshipAnalysisWithAuth() {
  try {
    console.log('🔐 Authenticating with backend...');
    
    // Login to get JWT token
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'admin@example.com',
      password: 'admin123'
    });
    
    if (!loginResponse.data.token) {
      throw new Error('Authentication failed - no token received');
    }
    
    const token = loginResponse.data.token;
    console.log('✅ Authentication successful');
    
    // Set up axios with authentication header
    const authenticatedAxios = axios.create({
      baseURL: API_BASE,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('🧪 Testing enhanced relationship analysis (Phase 1)...');
    
    // Test Phase 1: Confidence Analysis with array support
    const phase1Response = await authenticatedAxios.post('/modular-analysis/phase1-confidence-analysis', {
      timeout: 30000 // 30 second timeout
    });
    
    if (!phase1Response.data.success) {
      throw new Error(`Phase 1 failed: ${phase1Response.data.error}`);
    }
    
    console.log('✅ Phase 1 (Confidence Analysis) completed successfully');
    console.log('📊 Results:');
    console.log(`   - Total relationships analyzed: ${phase1Response.data.data.relationships?.length || 'N/A'}`);
    console.log(`   - High confidence relationships: ${phase1Response.data.data.statistics?.highConfidence || 'N/A'}`);
    console.log(`   - Medium confidence relationships: ${phase1Response.data.data.statistics?.mediumConfidence || 'N/A'}`);
    console.log(`   - Low confidence relationships: ${phase1Response.data.data.statistics?.lowConfidence || 'N/A'}`);
    
    // Show enhanced cardinality distribution
    if (phase1Response.data.data.cardinalityDistribution) {
      console.log('🔗 Cardinality Distribution:');
      console.log(`   - One-to-One: ${phase1Response.data.data.cardinalityDistribution['one-to-one'] || 0}`);
      console.log(`   - One-to-Many: ${phase1Response.data.data.cardinalityDistribution['one-to-many'] || 0}`);
      console.log(`   - Many-to-One: ${phase1Response.data.data.cardinalityDistribution['many-to-one'] || 0}`);
      console.log(`   - Many-to-Many: ${phase1Response.data.data.cardinalityDistribution['many-to-many'] || 0}`);
    }
    
    // Check for TEXT[] array relationships specifically
    if (phase1Response.data.data.topRelationships) {
      console.log('🔍 Debug: Total top relationships:', phase1Response.data.data.topRelationships.length);
      console.log('🔍 Debug: First relationship reasoning:', phase1Response.data.data.topRelationships[0]?.reasoning);
      
      const arrayRelationships = phase1Response.data.data.topRelationships.filter(rel => 
        rel.reasoning && rel.reasoning.includes('Array field:')
      );
      
      console.log(`   - TEXT[] array relationships: ${arrayRelationships.length}`);
      
      if (arrayRelationships.length > 0) {
        console.log('🎯 Enhanced TEXT[] array relationships with cardinality analysis:');
        arrayRelationships.slice(0, 5).forEach((rel, index) => {
          console.log(`     ${index + 1}. ${rel.fromTable}.${rel.fromField} → ${rel.toTable}.${rel.toField}`);
          console.log(`        Confidence: ${rel.confidence}% | Type: ${rel.relationshipType}`);
          console.log(`        Reasoning: ${rel.reasoning}`);
          
          // Show enhanced cardinality analysis if available
          if (rel.cardinalityAnalysis && !rel.cardinalityAnalysis.error) {
            console.log(`        📊 Cardinality: ${rel.cardinalityAnalysis.fromCardinality}-to-${rel.cardinalityAnalysis.toCardinality}`);
            console.log(`        📈 Max Links: From=${rel.cardinalityAnalysis.maxLinksFrom}, To=${rel.cardinalityAnalysis.maxLinksTo}`);
            console.log(`        💡 Analysis: ${rel.cardinalityAnalysis.analysis.fromSide}`);
            console.log(`        💡 Analysis: ${rel.cardinalityAnalysis.analysis.toSide}`);
          }
          console.log('');
        });
      }
    }
    
    return {
      success: true,
      phase1Results: phase1Response.data,
      arrayRelationshipsFound: phase1Response.data.data.topRelationships?.filter(rel => 
        rel.reasoning && rel.reasoning.includes('Array field:')
      ).length || 0
    };
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data?.error || error.message);
    
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Response:', JSON.stringify(error.response.data, null, 2));
    }
    
    return {
      success: false,
      error: error.message,
      details: error.response?.data
    };
  }
}

// Run the test
console.log('🚀 Starting relationship analysis test with authentication...');
testRelationshipAnalysisWithAuth()
  .then(result => {
    console.log('\n📋 Final Test Result:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\n🎉 SUCCESS: Enhanced relationship analysis is working with TEXT[] array support!');
      console.log(`   Found ${result.arrayRelationshipsFound} TEXT[] array relationships`);
    } else {
      console.log('\n❌ FAILURE: Test did not complete successfully');
    }
    
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n💥 Unexpected error:', error);
    process.exit(1);
  });