const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSettings() {
  try {
    const settings = await prisma.settings.findFirst({
      where: { userId: 1 } // Admin user
    });
    
    console.log('📋 Current Settings Configuration:');
    console.log('=====================================');
    console.log('API Key:', settings?.airtableApiKey ? '[CONFIGURED]' : '[NOT SET]');
    console.log('Base ID:', settings?.airtableBaseId || '[NOT SET]');
    console.log('Database URL:', settings?.databaseUrl || '[NOT SET]');
    console.log('');
    
    if (settings?.databaseUrl) {
      console.log('🎯 CRITICAL: Database URL Analysis:');
      console.log('Database URL:', settings.databaseUrl);
      
      // Check if it's pointing to the main database (bad) or external database (good)
      const isMainDatabase = settings.databaseUrl.includes('localhost') || 
                            settings.databaseUrl.includes('127.0.0.1') ||
                            settings.databaseUrl.includes('airtable_import') ||
                            !settings.databaseUrl.includes('postgresql://');
      
      if (isMainDatabase) {
        console.log('⚠️  WARNING: This appears to be the MAIN APPLICATION DATABASE!');
        console.log('⚠️  Imports will overwrite your application tables!');
        console.log('');
        console.log('🔧 SOLUTION: You need to configure a separate external database URL');
        console.log('   Example: postgresql://user:pass@your-server.com:5432/target_db');
      } else {
        console.log('✅ This appears to be an external database (good)');
      }
    } else {
      console.log('❌ No database URL configured - imports will fail');
      console.log('');
      console.log('🔧 SOLUTION: Configure a database URL in settings for import target');
    }
    
  } catch (error) {
    console.error('Error checking settings:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkSettings();