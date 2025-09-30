#!/usr/bin/env node

/**
 * Test the new Enhanced Database-First Relationship Analyzer
 * This analyzer uses all 7,765+ imported records instead of limited samples
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

async function testEnhancedRelationshipAnalysis() {
  try {
    console.log('🧪 Testing Enhanced Database-First Relationship Analyzer');
    console.log('=====================================================');
    
    // Login
    console.log('🔐 Authenticating...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@example.com',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    const config = {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
    
    // Check analyzer status
    console.log('\n📊 Checking enhanced analyzer status...');
    const statusResponse = await axios.get(`${BASE_URL}/enhanced-relationship-analysis/status`, config);
    
    console.log('✅ Enhanced analyzer available:');
    console.log('   Features:', statusResponse.data.features.join(', '));
    console.log('   Max Records:', statusResponse.data.capabilities.maxRecords);
    console.log('   Data Source:', statusResponse.data.capabilities.dataSource);
    
    // Run enhanced analysis
    console.log('\n🧠 Starting enhanced relationship analysis...');
    console.log('⏳ This will analyze ALL imported data (may take 1-2 minutes)...');
    
    const startTime = Date.now();
    const analysisResponse = await axios.post(
      `${BASE_URL}/enhanced-relationship-analysis/analyze-complete`,
      {},
      config
    );
    const analysisTime = Date.now() - startTime;
    
    const results = analysisResponse.data.data;
    
    console.log('\n🎉 Enhanced Analysis Complete!');
    console.log('===============================');
    console.log(`   Analysis Time: ${(analysisTime / 1000).toFixed(1)} seconds`);
    console.log(`   Total Tables Analyzed: ${results.statistics.totalTables}`);
    console.log(`   Total Records Analyzed: ${results.statistics.totalRecords.toLocaleString()}`);
    console.log(`   Relationships Found: ${results.summary.totalRelationships}`);
    
    console.log('\n📊 Confidence Distribution:');
    console.log(`   High Confidence (≥0.8): ${results.summary.highConfidenceRelationships}`);
    console.log(`   Medium Confidence (0.6-0.79): ${results.summary.mediumConfidenceRelationships}`);
    console.log(`   Low Confidence (<0.6): ${results.summary.lowConfidenceRelationships}`);
    
    console.log('\n🔍 Analysis Sources:');
    results.summary.analysisSources.forEach(source => {
      const count = results.relationships.filter(r => r.source === source).length;
      console.log(`   ${source}: ${count} relationships`);
    });
    
    console.log('\n🔗 Relationship Types:');
    results.summary.relationshipTypes.forEach(type => {
      const count = results.relationships.filter(r => r.relationshipType === type).length;
      console.log(`   ${type}: ${count} relationships`);
    });
    
    // Show top 10 highest confidence relationships
    console.log('\n🏆 Top 10 Highest Confidence Relationships:');
    const topRelationships = results.relationships
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10);
    
    topRelationships.forEach((rel, idx) => {
      console.log(`   ${idx + 1}. ${rel.fromTable}.${rel.fromField} → ${rel.toTable}.${rel.toField}`);
      console.log(`      Type: ${rel.relationshipType}, Confidence: ${(rel.confidence * 100).toFixed(1)}%`);
      console.log(`      Source: ${rel.source}`);
      console.log(`      Reasoning: ${rel.reasoning}`);
      console.log('');
    });
    
    // Show statistics
    if (results.statistics.confidenceDistribution) {
      console.log('📈 Detailed Confidence Distribution:');
      Object.entries(results.statistics.confidenceDistribution).forEach(([range, count]) => {
        console.log(`   ${range}: ${count}`);
      });
    }
    
    console.log('\n🎯 Analysis Comparison:');
    console.log('   Previous analyzer: Limited to ~50 records per table');
    console.log(`   Enhanced analyzer: Used all ${results.statistics.totalRecords.toLocaleString()} records`);
    console.log('   Result: More accurate relationship detection with complete dataset');
    
  } catch (error) {
    console.error('❌ Enhanced analysis test failed:', error.response?.data || error.message);
    if (error.response?.data?.details) {
      console.error('Error details:', error.response.data.details);
    }
  }
}

// Run the test
testEnhancedRelationshipAnalysis();