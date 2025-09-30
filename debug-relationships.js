#!/usr/bin/env node

/**
 * Debug script to examine relationship analysis details
 * Shows confidence levels and relationship types
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';
const TEST_CREDENTIALS = {
  email: 'admin@example.com',
  password: 'admin123'
};

async function debugRelationships() {
  try {
    // Login
    console.log('🔐 Logging in...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, TEST_CREDENTIALS);
    const token = loginResponse.data.token;
    
    const config = {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
    
    // Connect and run analysis to get fresh relationship data
    console.log('🔗 Starting fresh analysis...');
    const connectResponse = await axios.post(`${BASE_URL}/staged-workflow/connect`, {}, config);
    const sessionId = connectResponse.data.sessionId;
    
    // Run through stages to get to relationship analysis
    await axios.post(`${BASE_URL}/staged-workflow/discover-schema`, { sessionId }, config);
    await axios.post(`${BASE_URL}/staged-workflow/create-structure`, { sessionId }, config);
    await axios.post(`${BASE_URL}/staged-workflow/import-data`, { sessionId }, config);
    
    console.log('🧠 Running relationship analysis...');
    const analysisResponse = await axios.post(`${BASE_URL}/staged-workflow/analyze-relationships`, { sessionId }, config);
    
    const relationships = analysisResponse.data.data.relationships;
    console.log(`\n📊 Found ${relationships.length} relationships:`);
    
    // Group by confidence levels
    const confidenceBuckets = {
      'High (≥0.7)': relationships.filter(r => (r.confidence || 0) >= 0.7),
      'Medium (0.5-0.69)': relationships.filter(r => (r.confidence || 0) >= 0.5 && (r.confidence || 0) < 0.7),
      'Low (0.3-0.49)': relationships.filter(r => (r.confidence || 0) >= 0.3 && (r.confidence || 0) < 0.5),
      'Very Low (<0.3)': relationships.filter(r => (r.confidence || 0) < 0.3)
    };
    
    console.log('\n🎯 Confidence Level Distribution:');
    Object.entries(confidenceBuckets).forEach(([level, rels]) => {
      console.log(`   ${level}: ${rels.length} relationships`);
    });
    
    // Show sample relationships with details
    console.log('\n📋 Sample Relationships (first 10):');
    relationships.slice(0, 10).forEach((rel, idx) => {
      console.log(`   ${idx + 1}. ${rel.fromTable || 'N/A'}.${rel.fromField || 'N/A'} → ${rel.toTable || 'N/A'}.${rel.toField || 'N/A'}`);
      console.log(`      Type: ${rel.relationshipType || rel.type || 'unknown'}, Confidence: ${rel.confidence || 'N/A'}`);
    });
    
    // Check enhancement results
    console.log('\n⚡ Testing enhancements...');
    const enhancementResponse = await axios.post(`${BASE_URL}/staged-workflow/apply-enhancements`, { sessionId }, config);
    
    console.log(`\n🔧 Enhancement Results:`);
    console.log(`   Foreign keys created: ${enhancementResponse.data.data.foreignKeysCreated}`);
    console.log(`   Junction tables created: ${enhancementResponse.data.data.junctionTablesCreated}`);
    console.log(`   Total constraints added: ${enhancementResponse.data.data.constraintsAdded}`);
    
    const highConfCount = confidenceBuckets['High (≥0.7)'].length;
    console.log(`\n💡 Analysis: ${highConfCount} high-confidence relationships should have created ${highConfCount} enhancements`);
    
    if (highConfCount === 0) {
      console.log('   ❌ No relationships met the 0.7 confidence threshold for enhancement');
      console.log('   💡 Consider lowering the confidence threshold or improving relationship detection');
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.response?.data || error.message);
  }
}

console.log('🔍 Debugging Relationship Analysis & Enhancement Logic');
console.log('=====================================================');
debugRelationships();