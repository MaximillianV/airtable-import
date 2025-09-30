/**
 * Simple Test - Table Discovery Debug
 * Run from backend directory to test table name resolution
 */

const { PrismaClient } = require('@prisma/client');
const AirtableService = require('./src/services/airtable');

async function testTableDiscovery() {
  console.log('🧪 Testing Table Discovery...');
  
  const prisma = new PrismaClient();
  
  try {
    // Get settings
    const user = await prisma.user.findUnique({
      where: { email: 'admin@example.com' }
    });
    
    const settings = await prisma.settings.findUnique({
      where: { userId: user.id }
    });
    
    console.log('📋 Settings:', {
      hasApiKey: !!settings.airtableApiKey,
      hasBaseId: !!settings.airtableBaseId,
      apiKeyPreview: settings.airtableApiKey ? `${settings.airtableApiKey.substring(0, 12)}...` : 'NOT SET'
    });
    
    // Test Airtable connection
    const airtableService = new AirtableService();
    airtableService.connect(settings.airtableApiKey, settings.airtableBaseId);
    
    console.log('🔍 Testing discoverTables()...');
    const tableNames = await airtableService.discoverTables();
    console.log(`✅ discoverTables() returned ${tableNames.length} items:`);
    tableNames.slice(0, 5).forEach((item, index) => {
      console.log(`  ${index + 1}. "${item}" (${typeof item})`);
    });
    
    console.log('\n🔍 Testing discoverTablesWithCounts()...');
    const tableObjects = await airtableService.discoverTablesWithCounts();
    console.log(`✅ discoverTablesWithCounts() returned ${tableObjects.length} items:`);
    tableObjects.slice(0, 5).forEach((item, index) => {
      console.log(`  ${index + 1}. ${JSON.stringify(item)} (${typeof item})`);
    });
    
    // Test what the workflow should use
    console.log('\n🔍 Testing what workflow needs (table.name)...');
    tableObjects.slice(0, 3).forEach((table, index) => {
      console.log(`  ${index + 1}. table.name = "${table.name}" (${typeof table.name})`);
    });
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
    console.log('Full error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testTableDiscovery().catch(console.error);