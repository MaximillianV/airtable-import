/**
 * Database Cleanup Script
 * Removes conflicting ENUMs and tables to allow fresh import
 */

const { PrismaClient } = require('@prisma/client');

async function cleanupDatabase() {
  console.log('🧹 Cleaning up database for fresh import...');
  
  const prisma = new PrismaClient();
  
  try {
    // Drop all imported tables (keep users and settings)
    console.log('🗑️ Dropping imported tables...');
    
    const tableQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name NOT IN ('users', 'settings', '_prisma_migrations')
      ORDER BY table_name
    `;
    
    const tables = await prisma.$queryRawUnsafe(tableQuery);
    
    for (const table of tables) {
      try {
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${table.table_name}" CASCADE`);
        console.log(`  ✅ Dropped table: ${table.table_name}`);
      } catch (error) {
        console.log(`  ⚠️ Error dropping table ${table.table_name}: ${error.message}`);
      }
    }
    
    // Drop all custom ENUMs
    console.log('🗑️ Dropping custom ENUMs...');
    
    const enumQuery = `
      SELECT typname 
      FROM pg_type 
      WHERE typtype = 'e' 
      AND typname NOT LIKE 'pg_%'
      ORDER BY typname
    `;
    
    const enums = await prisma.$queryRawUnsafe(enumQuery);
    
    for (const enumType of enums) {
      try {
        await prisma.$executeRawUnsafe(`DROP TYPE IF EXISTS "${enumType.typname}" CASCADE`);
        console.log(`  ✅ Dropped ENUM: ${enumType.typname}`);
      } catch (error) {
        console.log(`  ⚠️ Error dropping ENUM ${enumType.typname}: ${error.message}`);
      }
    }
    
    console.log('✅ Database cleanup completed!');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupDatabase().catch(console.error);