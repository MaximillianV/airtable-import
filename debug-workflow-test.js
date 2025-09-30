/**
 * Debug Test Script - Mimics Frontend Full Import Workflow
 * 
 * This script tests the exact same workflow that the frontend triggers
 * to identify where the table name issue occurs and why the database import fails.
 */

const { PrismaClient } = require('@prisma/client');
const AirtableService = require('./backend/src/services/airtable');
const FullImportWorkflowService = require('./backend/src/services/fullImportWorkflow');

async function debugFullWorkflow() {
  console.log('🧪 DEBUG: Starting Full Import Workflow Test');
  console.log('=' .repeat(60));

  const prisma = new PrismaClient();
  
  try {
    // Step 1: Get user settings (same as frontend)
    console.log('📋 Step 1: Fetching user settings...');
    const user = await prisma.user.findUnique({
      where: { email: 'admin@example.com' }
    });
    
    if (!user) {
      throw new Error('Admin user not found');
    }
    
    const settings = await prisma.settings.findUnique({
      where: { userId: user.id }
    });
    
    if (!settings) {
      throw new Error('Settings not found for admin user');
    }
    
    console.log('✅ Settings found:', {
      airtableApiKey: settings.airtableApiKey ? `${settings.airtableApiKey.substring(0, 8)}...` : 'NOT SET',
      airtableBaseId: settings.airtableBaseId || 'NOT SET',
      databaseUrl: settings.databaseUrl ? 'SET' : 'NOT SET'
    });

    // Step 2: Test Airtable Service directly
    console.log('\n📋 Step 2: Testing Airtable Service...');
    const airtableService = new AirtableService();
    
    try {
      airtableService.connect(settings.airtableApiKey, settings.airtableBaseId);
      console.log('✅ Airtable service connected');
      
      // Test table discovery
      console.log('🔍 Testing table discovery...');
      const tables = await airtableService.discoverTables();
      console.log(`✅ Found ${tables.length} tables`);
      
      // Debug table structure
      console.log('\n🔍 DEBUG: Table structures:');
      tables.forEach((table, index) => {
        console.log(`  Table ${index + 1}:`, {
          raw: table,
          name: table.name,
          id: table.id,
          type: typeof table,
          keys: Object.keys(table || {})
        });
      });
      
      // Test getting schema for first few tables
      console.log('\n🔍 Testing schema retrieval for first 3 tables...');
      for (let i = 0; i < Math.min(3, tables.length); i++) {
        const table = tables[i];
        console.log(`\n  Testing schema for table: ${table.name} (${typeof table.name})`);
        
        try {
          const schema = await airtableService.getTableSchema(table.name);
          console.log(`  ✅ Schema retrieved for ${table.name}:`, {
            fieldsCount: schema.fields?.length || 0,
            firstFields: schema.fields?.slice(0, 3).map(f => f.name) || []
          });
        } catch (error) {
          console.log(`  ❌ Schema failed for ${table.name}:`, error.message);
        }
      }
      
    } catch (error) {
      console.log('❌ Airtable service error:', error.message);
      throw error;
    }

    // Step 3: Test Full Import Workflow Service
    console.log('\n📋 Step 3: Testing Full Import Workflow...');
    const workflowService = new FullImportWorkflowService(prisma);
    
    // Mock progress callback that logs everything
    const progressCallback = (message, stage, callback, data) => {
      console.log(`[PROGRESS] ${stage}: ${message}`, data ? `Data: ${JSON.stringify(data, null, 2)}` : '');
    };
    
    try {
      console.log('🚀 Starting full workflow execution...');
      const result = await workflowService.executeFullWorkflow(settings, progressCallback);
      console.log('✅ Workflow completed:', result);
      
    } catch (error) {
      console.log('❌ Workflow failed:', error.message);
      console.log('❌ Full error:', error);
      
      // Try to diagnose where it failed
      console.log('\n🔍 Diagnosing workflow failure...');
      
      // Test individual workflow steps
      try {
        console.log('  Testing Step 1: discoverAirtableSchema...');
        const schemaResult = await workflowService.discoverAirtableSchema(settings, progressCallback);
        console.log('  ✅ Schema discovery result:', {
          tablesCount: schemaResult.tables?.length || 0,
          sampleTables: schemaResult.tables?.slice(0, 3).map(t => ({
            name: t.name,
            type: typeof t.name,
            keys: Object.keys(t || {})
          })) || []
        });
      } catch (stepError) {
        console.log('  ❌ Schema discovery failed:', stepError.message);
      }
    }

    // Step 4: Check database state
    console.log('\n📋 Step 4: Checking database state...');
    
    try {
      // Check if any tables were created
      const tableQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name NOT IN ('users', 'settings', '_prisma_migrations')
        ORDER BY table_name
      `;
      
      const importedTables = await prisma.$queryRawUnsafe(tableQuery);
      console.log(`📊 Found ${importedTables.length} imported tables in database:`);
      importedTables.forEach(table => {
        console.log(`  - ${table.table_name}`);
      });
      
      if (importedTables.length === 0) {
        console.log('⚠️  No imported tables found - database import definitely failed');
      }
      
    } catch (dbError) {
      console.log('❌ Database check failed:', dbError.message);
    }

  } catch (error) {
    console.log('💥 Test failed with error:', error.message);
    console.log('💥 Full error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the debug test
debugFullWorkflow().catch(console.error);