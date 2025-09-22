/**
 * Quick Prisma Integration Test
 * 
 * This script tests the Prisma database service to ensure
 * all CRUD operations are working correctly with PostgreSQL.
 */

const { prismaDatabaseService } = require('./src/services/prismaDatabase');

async function testPrismaIntegration() {
  console.log('🧪 Testing Prisma Integration...\n');

  try {
    // Test 1: Database Connection
    console.log('1️⃣ Testing database connection...');
    await prismaDatabaseService.connect();
    console.log('✅ Database connected successfully\n');

    // Test 2: User Operations
    console.log('2️⃣ Testing user operations...');
    const testEmail = `test_user_${Date.now()}@example.com`;
    const testUser = await prismaDatabaseService.createUser(testEmail, 'hashed_password_123');
    console.log(`✅ User created: ${testUser.email} (ID: ${testUser.id})`);

    const foundUser = await prismaDatabaseService.findUserByEmail(testEmail);
    console.log(`✅ User found: ${foundUser.email}\n`);

    // Test 3: Settings Operations
    console.log('3️⃣ Testing settings operations...');
    const testSettings = await prismaDatabaseService.saveSettings(testUser.id, {
      airtableApiKey: 'test-key-123',
      airtableBaseId: 'appTestBase456',
      databaseUrl: 'postgresql://test:test@localhost:5432/test'
    });
    console.log(`✅ Settings saved for user ${testUser.id}`);

    const retrievedSettings = await prismaDatabaseService.getSettings(testUser.id);
    console.log(`✅ Settings retrieved: ${retrievedSettings.airtableBaseId}\n`);

    // Test 4: Import Session Operations
    console.log('4️⃣ Testing import session operations...');
    const session = await prismaDatabaseService.createImportSession(testUser.id, ['Table1', 'Table2']);
    console.log(`✅ Import session created: ${session.id}`);

    const updatedSession = await prismaDatabaseService.updateImportSession(session.id, {
      status: 'COMPLETED',
      processedRecords: 2,
      endTime: new Date()
    });
    console.log(`✅ Import session updated: ${updatedSession.status}\n`);

    // Test 5: Database Statistics
    console.log('5️⃣ Testing database statistics...');
    const stats = await prismaDatabaseService.getDatabaseStats();
    console.log(`✅ Database stats:`, {
      users: stats.users,
      importSessions: stats.importSessions,
      status: stats.status
    });

    console.log('\n🎉 All Prisma integration tests passed!');
    console.log('\n📊 Database Summary:');
    console.log(`   • Users: ${stats.users}`);
    console.log(`   • Import Sessions: ${stats.importSessions}`);
    console.log(`   • Imported Tables: ${stats.importedTables}`);
    console.log(`   • Airtable Schemas: ${stats.airtableSchemas}`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    // Clean up
    await prismaDatabaseService.disconnect();
    console.log('\n🔌 Database disconnected');
    process.exit(0);
  }
}

// Run the test
testPrismaIntegration();