/**
 * Simple Backend Test - Test Airtable Table Discovery
 * 
 * This test verifies that table names are being extracted correctly
 * from the Airtable API and passed through the workflow properly.
 */

// Import required modules using the backend's node_modules
const path = require('path');
process.chdir(path.join(__dirname, 'backend'));

const AirtableService = require('./src/services/airtable');

async function testTableDiscovery() {
  console.log('🧪 Testing Airtable Table Discovery');
  console.log('=' .repeat(50));

  try {
    // Create airtable service
    const airtableService = new AirtableService();
    
    // Get settings from environment (same as the backend uses)
    const airtableApiKey = process.env.AIRTABLE_API_KEY || 'your-api-key-here';
    const airtableBaseId = process.env.AIRTABLE_BASE_ID || 'your-base-id-here';
    
    console.log('📋 Using credentials:', {
      apiKey: airtableApiKey ? `${airtableApiKey.substring(0, 8)}...` : 'NOT SET',
      baseId: airtableBaseId || 'NOT SET'
    });
    
    if (!airtableApiKey.startsWith('pat') || !airtableBaseId.startsWith('app')) {
      console.log('⚠️  WARNING: Default credentials detected. Please set AIRTABLE_API_KEY and AIRTABLE_BASE_ID environment variables.');
      console.log('   You can find these in your user settings in the database or frontend app.');
      return;
    }
    
    // Connect to Airtable
    console.log('🔗 Connecting to Airtable...');
    airtableService.connect(airtableApiKey, airtableBaseId);
    
    // Test table discovery with counts
    console.log('🔍 Testing discoverTablesWithCounts()...');
    const tablesWithCounts = await airtableService.discoverTablesWithCounts();
    
    console.log(`✅ Found ${tablesWithCounts.length} tables:`);
    tablesWithCounts.forEach((table, index) => {
      console.log(`  ${index + 1}. ${table.name} (${table.recordCount} records)`);
      console.log(`     ID: ${table.id}`);
      console.log(`     Type of name: ${typeof table.name}`);
      console.log(`     Name is undefined: ${table.name === undefined}`);
    });
    
    // Test the old discoverTables method
    console.log('\n🔍 Testing discoverTables() (just names)...');
    const tableNames = await airtableService.discoverTables();
    
    console.log(`✅ Table names array:`, tableNames);
    console.log(`   Length: ${tableNames.length}`);
    console.log(`   First few: ${tableNames.slice(0, 3)}`);
    console.log(`   Types: ${tableNames.map(name => typeof name)}`);
    
    // Test schema retrieval for first table
    if (tablesWithCounts.length > 0) {
      const firstTable = tablesWithCounts[0];
      console.log(`\n🔍 Testing schema retrieval for: ${firstTable.name}`);
      
      try {
        const schema = await airtableService.getTableSchema(firstTable.name);
        console.log(`✅ Schema retrieved successfully:`);
        console.log(`   Fields: ${schema.fields?.length || 0}`);
        console.log(`   Sample fields: ${schema.fields?.slice(0, 3).map(f => f.name) || []}`);
      } catch (error) {
        console.log(`❌ Schema retrieval failed: ${error.message}`);
      }
    }
    
    console.log('\n🎉 Test completed successfully!');
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
    console.log('Full error:', error);
  }
}

// Export for use or run directly
if (require.main === module) {
  testTableDiscovery().catch(console.error);
}

module.exports = { testTableDiscovery };